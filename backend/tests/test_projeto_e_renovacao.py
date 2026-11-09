import time

from app.central import parse_qr
from app.security import deve_renovar, nova_sessao, seal, unseal
from app.settings import Settings

from .conftest import HOST, PROJECT, TOKEN, qr_url


def test_projeto_do_qr_e_aceito_sem_allowlist(settings):
    sem_lista = Settings(
        session_secret=settings.session_secret,
        allowed_hosts=settings.allowed_hosts,
        allowed_projects=(),
        cookie_secure=False,
    )
    conexao = parse_qr(qr_url(project='77'), sem_lista)
    assert conexao.project_id == '77'


def test_allowlist_de_projeto_continua_valendo_quando_definida(settings):
    import pytest
    from app.central import QrInvalido

    with pytest.raises(QrInvalido):
        parse_qr(qr_url(project='77'), settings)


def test_host_fora_da_allowlist_continua_recusado_mesmo_sem_lista_de_projeto(settings):
    import pytest
    from app.central import QrInvalido

    sem_lista = Settings(
        session_secret=settings.session_secret,
        allowed_hosts=settings.allowed_hosts,
        allowed_projects=(),
        cookie_secure=False,
    )
    with pytest.raises(QrInvalido):
        parse_qr(qr_url(host='outro.exemplo.test'), sem_lista)


def test_renova_na_metade_do_prazo():
    dados = nova_sessao(TOKEN, HOST, PROJECT, 3600)
    assert deve_renovar(dados, 3600, agora=dados['iat'] + 1800)
    assert not deve_renovar(dados, 3600, agora=dados['iat'] + 100)


def test_cookie_renovado_mantem_identidade(settings):
    original = nova_sessao(TOKEN, HOST, PROJECT, 3600)
    renovado = unseal(settings.session_secret, seal(settings.session_secret, original))
    assert renovado['token'] == original['token']
    assert renovado['project_id'] == original['project_id']


def test_renovacao_no_servidor_reemite_cookie(client):
    client.post('/api/v1/connections', json={'qr': qr_url()})
    antes = client.cookies.get('modk_session')
    # força expiração próxima reescrevendo o cookie com prazo curto
    from app.main import app

    configuracao = app.state.settings
    curto = nova_sessao(TOKEN, HOST, PROJECT, 120)
    client.cookies.set('modk_session', seal(configuracao.session_secret, curto))
    resposta = client.get('/api/v1/forms')
    assert resposta.status_code == 200
    depois = resposta.cookies.get('modk_session') or client.cookies.get('modk_session')
    assert depois and depois != antes


def test_nome_do_projeto_vem_do_qr(client):
    import base64
    import json
    import zlib

    from .conftest import qr_url

    payload = {'general': {'server_url': qr_url()}, 'project': {'name': 'IFNMG - Almenara - 3'}}
    bruto = base64.b64encode(zlib.compress(json.dumps(payload).encode())).decode()

    corpo = client.post('/api/v1/connections', json={'qr': bruto}).json()
    assert corpo['scope']['projectName'] == 'IFNMG - Almenara - 3'
    assert client.get('/api/v1/session').json()['scope']['projectName'] == 'IFNMG - Almenara - 3'


def test_url_pura_gera_nome_de_fallback(client):
    from .conftest import PROJECT, qr_url

    corpo = client.post('/api/v1/connections', json={'qr': qr_url()}).json()
    assert corpo['scope']['projectName'] == f'Projeto {PROJECT}'
