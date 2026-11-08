import base64
import zlib

import pytest

from app.central import QrInvalido, parse_qr

from .conftest import HOST, PROJECT, TOKEN, qr_url


def test_aceita_url_pura(settings):
    conexao = parse_qr(qr_url(), settings)
    assert (conexao.host, conexao.token, conexao.project_id) == (HOST, TOKEN, PROJECT)


def test_aceita_qr_comprimido_do_collect(settings):
    import json

    payload = {'general': {'server_url': qr_url()}, 'project': {'name': 'teste'}}
    bruto = base64.b64encode(zlib.compress(json.dumps(payload).encode())).decode()
    conexao = parse_qr(bruto, settings)
    assert conexao.token == TOKEN


def test_recusa_host_fora_da_allowlist(settings):
    with pytest.raises(QrInvalido, match='allowlist'):
        parse_qr(qr_url(host='outro.exemplo.test'), settings)


def test_recusa_projeto_fora_da_allowlist(settings):
    with pytest.raises(QrInvalido, match='projeto'):
        parse_qr(qr_url(project='99'), settings)


def test_recusa_http(settings):
    with pytest.raises(QrInvalido, match='https'):
        parse_qr(f'http://{HOST}/v1/key/{TOKEN}/projects/{PROJECT}', settings)


def test_conexao_emite_cookie_e_devolve_workspace(client):
    resposta = client.post('/api/v1/connections', json={'qr': qr_url()})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert len(corpo['workspaceId']) == 32
    assert corpo['forms'] == 2
    assert 'modk_session' in resposta.cookies
    # o token nunca é devolvido
    assert TOKEN not in resposta.text


def test_sessao_reaproveita_workspace(client):
    primeiro = client.post('/api/v1/connections', json={'qr': qr_url()}).json()
    sessao = client.get('/api/v1/session').json()
    assert sessao['workspaceId'] == primeiro['workspaceId']


def test_credencial_recusada_nao_cria_sessao(client):
    resposta = client.post(
        '/api/v1/connections', json={'qr': qr_url(token='tok-invalido')}
    )
    assert resposta.status_code == 401
    assert resposta.json()['code'] == 'AUTH_REQUIRED'
    assert 'modk_session' not in resposta.cookies


def test_sem_sessao_retorna_401(client):
    assert client.get('/api/v1/session').status_code == 401


def test_encerrar_sessao(client):
    client.post('/api/v1/connections', json={'qr': qr_url()})
    assert client.delete('/api/v1/session').status_code == 204
    assert client.get('/api/v1/session').status_code == 401


def test_cookie_adulterado_nao_autentica(client):
    client.post('/api/v1/connections', json={'qr': qr_url()})
    original = client.cookies.get('modk_session')
    client.cookies.set('modk_session', original[:-4] + 'AAAA')
    assert client.get('/api/v1/session').status_code == 401
