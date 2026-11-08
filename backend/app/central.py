"""Leitura do QR do App User e client do ODK Central.

O QR entregue pelo Central é o mesmo que o Collect importa: um JSON comprimido
(base64 + zlib) cujo `general.server_url` contém
`https://<host>/v1/key/<token>/projects/<id>`. Também aceitamos a URL pura, para
quem preferir colar.
"""

from __future__ import annotations

import base64
import json
import zlib
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

import httpx
from defusedxml import ElementTree as DefusedET

from .settings import Settings


class QrInvalido(ValueError):
    """Conteúdo de QR que não descreve uma conexão aceitável."""


class CentralError(RuntimeError):
    def __init__(self, code: str, message: str, status: int | None = None):
        super().__init__(message)
        self.code = code
        self.status = status


@dataclass(frozen=True)
class Conexao:
    host: str
    token: str
    project_id: str

    @property
    def base_url(self) -> str:
        return f'https://{self.host}/v1/key/{self.token}/projects/{self.project_id}'


def _server_url(bruto: str) -> str:
    texto = bruto.strip()

    if texto.startswith('{'):
        dados = json.loads(texto)
        if isinstance(dados, dict) and 'general' in dados:
            return dados['general']['server_url']
        raise QrInvalido('JSON sem general.server_url')

    if texto.startswith('http://') or texto.startswith('https://'):
        return texto

    # QR do Collect: base64 de JSON comprimido com zlib.
    try:
        descomprimido = zlib.decompress(base64.b64decode(texto + '=' * (-len(texto) % 4)))
        dados = json.loads(descomprimido)
        return dados['general']['server_url']
    except Exception as exc:  # noqa: BLE001 - formato desconhecido
        raise QrInvalido('conteúdo de QR não reconhecido') from exc


def parse_qr(bruto: str, settings: Settings) -> Conexao:
    url = _server_url(bruto)
    partes = urlparse(url)

    if partes.scheme != 'https':
        raise QrInvalido('o servidor precisa ser https')
    host = (partes.hostname or '').lower()
    if host not in settings.allowed_hosts:
        raise QrInvalido('servidor fora da allowlist')

    caminho = partes.path.strip('/').split('/')
    if len(caminho) != 5 or caminho[0] != 'v1' or caminho[1] != 'key' or caminho[3] != 'projects':
        raise QrInvalido('formato de URL do Central não reconhecido')

    token = unquote(caminho[2])
    projeto = caminho[4]
    if not token or not projeto.isdigit():
        raise QrInvalido('token ou projeto inválido')

    if settings.allowed_projects and projeto not in settings.allowed_projects:
        raise QrInvalido('projeto fora da allowlist')

    return Conexao(host=host, token=token, project_id=projeto)


class CentralClient:
    """Cliente mínimo das operações OpenRosa usadas pela coleta."""

    def __init__(self, conexao: Conexao, settings: Settings, transport: httpx.AsyncBaseTransport | None = None):
        self._conexao = conexao
        self._settings = settings
        self._transport = transport

    def _client(self, timeout: float | None = None) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=timeout or self._settings.central_timeout_seconds,
            transport=self._transport,
            headers={'X-OpenRosa-Version': '1.0'},
            follow_redirects=False,
        )

    async def form_list(self) -> list[dict[str, str]]:
        async with self._client() as client:
            resposta = await client.get(f'{self._conexao.base_url}/formList')
        _verificar(resposta)
        return _parse_form_list(resposta.content)

    async def form_xml(self, xml_form_id: str) -> bytes:
        async with self._client() as client:
            resposta = await client.get(f'{self._conexao.base_url}/forms/{xml_form_id}.xml')
        _verificar(resposta)
        _limitar(resposta.content, self._settings.max_resource_bytes, 'XML do formulário')
        return resposta.content

    async def manifest(self, xml_form_id: str) -> list[dict[str, str]]:
        async with self._client() as client:
            resposta = await client.get(f'{self._conexao.base_url}/forms/{xml_form_id}/manifest')
        _verificar(resposta)
        return _parse_manifest(resposta.content)

    async def resource(self, xml_form_id: str, filename: str) -> tuple[bytes, str]:
        async with self._client() as client:
            resposta = await client.get(
                f'{self._conexao.base_url}/forms/{xml_form_id}/attachments/{filename}'
            )
        _verificar(resposta)
        _limitar(resposta.content, self._settings.max_resource_bytes, 'recurso')
        return resposta.content, resposta.headers.get('content-type', 'application/octet-stream')

    async def submit(self, corpo: bytes, content_type: str) -> httpx.Response:
        _limitar(corpo, self._settings.max_submission_bytes, 'submissão')
        async with self._client(timeout=120.0) as client:
            return await client.post(
                f'{self._conexao.base_url}/submission',
                content=corpo,
                headers={'Content-Type': content_type},
            )


def _limitar(conteudo: bytes, limite: int, descricao: str) -> None:
    if len(conteudo) > limite:
        raise CentralError(
            'PAYLOAD_TOO_LARGE',
            f'{descricao} excede o limite de {limite} bytes',
            status=413,
        )


def _verificar(resposta: httpx.Response) -> None:
    if resposta.status_code in (401, 403):
        raise CentralError('AUTH_REQUIRED', 'credencial recusada pelo Central', resposta.status_code)
    if resposta.status_code >= 400:
        raise CentralError(
            'REMOTE_UNAVAILABLE',
            f'Central respondeu {resposta.status_code}',
            resposta.status_code,
        )


def _parse_form_list(conteudo: bytes) -> list[dict[str, str]]:
    raiz = DefusedET.fromstring(conteudo)
    formularios: list[dict[str, str]] = []
    for xform in raiz:
        if not xform.tag.endswith('xform'):
            continue
        item = {filho.tag.split('}')[-1]: (filho.text or '').strip() for filho in xform}
        if item.get('formID'):
            formularios.append(
                {
                    'xmlFormId': item['formID'],
                    'name': item.get('name', item['formID']),
                    'version': item.get('version', ''),
                    'hash': item.get('hash', ''),
                }
            )
    return formularios


def _parse_manifest(conteudo: bytes) -> list[dict[str, str]]:
    raiz = DefusedET.fromstring(conteudo)
    recursos: list[dict[str, str]] = []
    for item in raiz:
        if not item.tag.endswith('mediaFile'):
            continue
        dados = {filho.tag.split('}')[-1]: (filho.text or '').strip() for filho in item}
        if dados.get('filename'):
            recursos.append(
                {
                    'filename': dados['filename'],
                    'hash': dados.get('hash', ''),
                    'downloadUrl': dados.get('downloadUrl', ''),
                }
            )
    return recursos
