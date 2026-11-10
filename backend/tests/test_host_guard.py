"""Guarda SSRF dinâmica: allowlist opcional e host público por padrão."""

from __future__ import annotations

import socket

import pytest

from app import central
from app.central import QrInvalido, parse_qr
from app.settings import Settings

SECRET = b'0' * 32


def _settings(**kwargs) -> Settings:
    return Settings(session_secret=SECRET, **kwargs)


def _qr(host: str) -> str:
    return f'https://{host}/v1/key/tok/projects/1'


def _resolve_para(monkeypatch, *ips: str) -> None:
    def fake(host, port, **kwargs):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, port)) for ip in ips]

    monkeypatch.setattr(central, '_resolver', fake)


def _sem_dns(monkeypatch) -> None:
    def fake(*args, **kwargs):
        raise AssertionError('não deveria resolver DNS quando há allowlist')

    monkeypatch.setattr(central, '_resolver', fake)


@pytest.mark.parametrize(
    'ip',
    [
        '93.184.216.34',
        '2606:2800:220:1:248:1893:25c8:1946',
    ],
)
def test_sem_allowlist_aceita_host_publico(monkeypatch, ip):
    _resolve_para(monkeypatch, ip)

    conexao = parse_qr(_qr('central.exemplo.test'), _settings())

    assert conexao.host == 'central.exemplo.test'


@pytest.mark.parametrize(
    'ip',
    [
        '127.0.0.1',
        '10.1.2.3',
        '192.168.1.10',
        '172.16.0.5',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0',
        '224.0.0.1',
        '::1',
        'fe80::1',
        'fc00::1',
        '::ffff:127.0.0.1',
    ],
)
def test_sem_allowlist_recusa_endereco_nao_publico(monkeypatch, ip):
    _resolve_para(monkeypatch, ip)

    with pytest.raises(QrInvalido, match='não público'):
        parse_qr(_qr('central.exemplo.test'), _settings())


def test_sem_allowlist_recusa_se_qualquer_resposta_for_privada(monkeypatch):
    _resolve_para(monkeypatch, '93.184.216.34', '10.0.0.7')

    with pytest.raises(QrInvalido, match='não público'):
        parse_qr(_qr('central.exemplo.test'), _settings())


def test_sem_allowlist_recusa_dns_que_nao_resolve(monkeypatch):
    def fake(*args, **kwargs):
        raise socket.gaierror('nome inexistente')

    monkeypatch.setattr(central, '_resolver', fake)

    with pytest.raises(QrInvalido, match='resolver'):
        parse_qr(_qr('central.exemplo.test'), _settings())


def test_allowlist_preexistente_nao_faz_dns(monkeypatch):
    _sem_dns(monkeypatch)

    conexao = parse_qr(
        _qr('central.exemplo.test'), _settings(allowed_hosts=('central.exemplo.test',))
    )

    assert conexao.host == 'central.exemplo.test'


def test_allowlist_preexistente_recusa_host_fora_dela(monkeypatch):
    _sem_dns(monkeypatch)

    with pytest.raises(QrInvalido, match='allowlist'):
        parse_qr(
            _qr('outro.exemplo.test'),
            _settings(allowed_hosts=('central.exemplo.test',)),
        )


def test_allowlist_permite_central_privado_por_configuracao(monkeypatch):
    _sem_dns(monkeypatch)

    conexao = parse_qr(_qr('central.interno'), _settings(allowed_hosts=('central.interno',)))

    assert conexao.host == 'central.interno'


def test_allowlist_vazia_aceita_qualquer_projeto(monkeypatch):
    _resolve_para(monkeypatch, '93.184.216.34')

    conexao = parse_qr(_qr('central.exemplo.test'), _settings(allowed_projects=()))

    assert conexao.project_id == '1'


def test_destino_que_deixa_de_validar_no_meio_da_sessao_retorna_502(client, monkeypatch):
    import base64

    from app.main import app

    from .conftest import SECRET, qr_url

    app.state.settings = Settings(
        session_secret=base64.b64decode(SECRET), allowed_hosts=(), cookie_secure=False
    )
    _resolve_para(monkeypatch, '93.184.216.34')
    assert client.post('/api/v1/connections', json={'qr': qr_url()}).status_code == 200

    def falha(*args, **kwargs):
        raise socket.gaierror('resolvedor fora do ar')

    monkeypatch.setattr(central, '_resolver', falha)

    resposta = client.get('/api/v1/forms')

    assert resposta.status_code == 502
    assert resposta.json() == {
        'code': 'REMOTE_UNAVAILABLE',
        'message': 'não foi possível resolver o servidor',
        'retryable': True,
    }
