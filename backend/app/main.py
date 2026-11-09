"""Adaptador REST entre a PWA e o ODK Central.

Cada agente usa o seu próprio App User, configurado por QR. O token é trocado por
um cookie de sessão cifrado e nunca é devolvido ao cliente (ADR 0003).
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .central import CentralClient, CentralError, QrInvalido, parse_qr
from .security import SessionInvalid, derive_workspace_id, deve_renovar, nova_sessao, seal, unseal
from .settings import Settings, load_settings

logger = logging.getLogger('my_odk_client')

COOKIE = 'modk_session'
STATIC_DIR = Path(os.environ.get('STATIC_DIR', Path(__file__).parent / 'static'))

@asynccontextmanager
async def lifespan(_: FastAPI):
    settings()  # falha na inicialização se a configuração estiver incompleta
    yield


app = FastAPI(
    title='My ODK Client',
    version='0.6.0',
    docs_url='/api/docs',
    openapi_url='/api/openapi.json',
    lifespan=lifespan,
)


# --------------------------------------------------------------------------- #
# configuração
# --------------------------------------------------------------------------- #


def settings() -> Settings:
    configuracao = getattr(app.state, 'settings', None)
    if configuracao is None:
        configuracao = load_settings()
        app.state.settings = configuracao
    return configuracao


def erro(code: str, message: str, status: int, retryable: bool = False) -> JSONResponse:
    return JSONResponse(
        {'code': code, 'message': message, 'retryable': retryable}, status_code=status
    )


# --------------------------------------------------------------------------- #
# sessão
# --------------------------------------------------------------------------- #


class QrRequest(BaseModel):
    qr: str = Field(min_length=1, max_length=8192)


def sessao_atual(request: Request) -> dict:
    blob = request.cookies.get(COOKIE)
    if not blob:
        raise SessionInvalid('sem cookie de sessão')
    return unseal(settings().session_secret, blob)


def cliente_central(request: Request, dados: dict | None = None) -> CentralClient:
    dados = dados or sessao_atual(request)
    conexao = parse_qr(
        f"https://{dados['host']}/v1/key/{dados['token']}/projects/{dados['project_id']}",
        settings(),
    )
    return CentralClient(conexao, settings(), getattr(app.state, 'central_transport', None))


@app.middleware('http')
async def renovar_sessao(request: Request, call_next):
    """Renovação deslizante: sessão válida não expira enquanto o app é usado."""
    resposta = await call_next(request)
    blob = request.cookies.get(COOKIE)
    if not blob or request.url.path.startswith('/api/v1/connections'):
        return resposta

    configuracao = settings()
    try:
        dados = unseal(configuracao.session_secret, blob)
    except SessionInvalid:
        return resposta

    if deve_renovar(dados, configuracao.session_ttl_seconds):
        renovado = nova_sessao(
            dados['token'],
            dados['host'],
            dados['project_id'],
            configuracao.session_ttl_seconds,
            dados.get('project_name'),
        )
        resposta.set_cookie(
            COOKIE,
            seal(configuracao.session_secret, renovado),
            max_age=configuracao.session_ttl_seconds,
            httponly=True,
            secure=configuracao.cookie_secure,
            samesite='strict',
            path='/',
        )
    return resposta


@app.exception_handler(SessionInvalid)
async def _session_handler(_: Request, exc: SessionInvalid) -> JSONResponse:
    return erro('AUTH_REQUIRED', f'sessão inválida: {exc}', 401)


@app.exception_handler(CentralError)
async def _central_handler(_: Request, exc: CentralError) -> JSONResponse:
    status = 401 if exc.code == 'AUTH_REQUIRED' else (413 if exc.code == 'PAYLOAD_TOO_LARGE' else 502)
    retryable = exc.code == 'REMOTE_UNAVAILABLE'
    return erro(exc.code, str(exc), status, retryable)


@app.get('/api/health')
async def health() -> dict:
    return {'status': 'ok', 'service': 'my-odk-client'}


@app.post('/api/v1/connections')
async def conectar(payload: QrRequest, response: Response) -> dict:
    configuracao = settings()
    try:
        conexao = parse_qr(payload.qr, configuracao)
    except QrInvalido as exc:
        return erro('UNSUPPORTED_FORM', str(exc), 400)

    cliente = CentralClient(conexao, configuracao, getattr(app.state, 'central_transport', None))
    formularios = await cliente.form_list()  # valida a credencial de fato

    dados = nova_sessao(
        conexao.token,
        conexao.host,
        conexao.project_id,
        configuracao.session_ttl_seconds,
        conexao.project_name,
    )
    response.set_cookie(
        COOKIE,
        seal(configuracao.session_secret, dados),
        max_age=configuracao.session_ttl_seconds,
        httponly=True,
        secure=configuracao.cookie_secure,
        samesite='strict',
        path='/',
    )

    return {
        'connectionId': derive_workspace_id(configuracao.session_secret, conexao.token),
        'workspaceId': derive_workspace_id(configuracao.session_secret, conexao.token),
        'scope': {
            'host': conexao.host,
            'projectId': conexao.project_id,
            'projectName': dados['project_name'],
        },
        'forms': len(formularios),
        'expiresIn': configuracao.session_ttl_seconds,
    }


@app.get('/api/v1/session')
async def sessao(request: Request) -> dict:
    dados = sessao_atual(request)
    return {
        'workspaceId': derive_workspace_id(settings().session_secret, dados['token']),
        'scope': {
            'host': dados['host'],
            'projectId': dados['project_id'],
            'projectName': dados.get('project_name') or f"Projeto {dados['project_id']}",
        },
        'expiresAt': dados['exp'],
    }


@app.delete('/api/v1/session', status_code=204)
async def encerrar(request: Request) -> Response:
    sessao_atual(request)
    resposta = Response(status_code=204)
    resposta.delete_cookie(COOKIE, path='/')
    return resposta


# --------------------------------------------------------------------------- #
# formulários
# --------------------------------------------------------------------------- #


@app.get('/api/v1/forms')
async def listar_formularios(request: Request) -> dict:
    cliente = cliente_central(request)
    return {'forms': await cliente.form_list()}


@app.get('/api/v1/forms/{xml_form_id}/package')
async def pacote(xml_form_id: str, request: Request) -> dict:
    cliente = cliente_central(request)
    xml = await cliente.form_xml(xml_form_id)
    recursos = await cliente.manifest(xml_form_id)

    return {
        'xmlFormId': xml_form_id,
        'xml': xml.decode('utf-8', errors='replace'),
        'resources': [
            {
                'filename': item['filename'],
                'hash': item['hash'],
                'url': f'/api/v1/forms/{xml_form_id}/resources/{item["filename"]}',
            }
            for item in recursos
        ],
    }


@app.get('/api/v1/forms/{xml_form_id}/resources/{filename}')
async def recurso(xml_form_id: str, filename: str, request: Request) -> Response:
    if '/' in filename or '\\' in filename or '..' in filename:
        return erro('RESOURCE_PATH_INVALID', 'nome de recurso inválido', 400)

    cliente = cliente_central(request)
    conteudo, content_type = await cliente.resource(xml_form_id, filename)
    return Response(content=conteudo, media_type=content_type)


# --------------------------------------------------------------------------- #
# submissões
# --------------------------------------------------------------------------- #


@app.post('/api/v1/submissions', status_code=201)
async def enviar(request: Request) -> Response:
    sessao_atual(request)

    tipo = request.headers.get('content-type', '')
    if not tipo.startswith('multipart/form-data'):
        return erro('UNSUPPORTED_FORM', 'submissão precisa ser multipart/form-data', 415)

    corpo = await request.body()
    cliente = cliente_central(request)
    resposta = await cliente.submit(corpo, tipo)

    if resposta.status_code == 201:
        return JSONResponse({'status': 'confirmed', 'centralStatus': 201}, status_code=201)
    if resposta.status_code in (401, 403):
        return erro('AUTH_REQUIRED', 'credencial recusada pelo Central', 401)
    if resposta.status_code == 409:
        return erro('REMOTE_CONFLICT', 'o Central recusou a submissão por conflito', 409)
    if resposta.status_code == 413:
        return erro('PAYLOAD_TOO_LARGE', 'o Central recusou por tamanho', 413)
    if resposta.status_code >= 500:
        return erro('REMOTE_UNAVAILABLE', f'Central respondeu {resposta.status_code}', 502, retryable=True)

    return erro('OUTCOME_UNKNOWN', f'resposta inesperada do Central: {resposta.status_code}', 502, retryable=True)


# --------------------------------------------------------------------------- #
# PWA estática (mesma origem, para não haver CORS entre app e API)
# --------------------------------------------------------------------------- #

if STATIC_DIR.is_dir():
    app.mount('/', StaticFiles(directory=STATIC_DIR, html=True), name='pwa')
else:  # pragma: no cover - ambiente de teste sem build do frontend
    logger.warning('diretório estático ausente: %s', STATIC_DIR)
