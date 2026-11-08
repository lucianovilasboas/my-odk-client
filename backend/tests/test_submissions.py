import httpx

from .conftest import qr_url

MULTIPART = 'multipart/form-data; boundary=xyz'


def autenticado(client):
    client.post('/api/v1/connections', json={'qr': qr_url()})
    return client


def corpo_multipart() -> bytes:
    return (
        b'--xyz\r\nContent-Disposition: form-data; name="xml_submission_file"; '
        b'filename="submission.xml"\r\nContent-Type: text/xml\r\n\r\n'
        b'<?xml version="1.0"?><data/>\r\n--xyz--\r\n'
    )


def test_encaminha_e_confirma_201(client):
    resposta = autenticado(client).post(
        '/api/v1/submissions', content=corpo_multipart(), headers={'Content-Type': MULTIPART}
    )
    assert resposta.status_code == 201
    assert resposta.json()['status'] == 'confirmed'


def test_409_vira_conflito_explicito(client, monkeypatch):
    from app import central

    async def conflito(self, corpo, content_type):
        return httpx.Response(409)

    monkeypatch.setattr(central.CentralClient, 'submit', conflito)
    resposta = autenticado(client).post(
        '/api/v1/submissions', content=corpo_multipart(), headers={'Content-Type': MULTIPART}
    )
    assert resposta.status_code == 409
    assert resposta.json()['code'] == 'REMOTE_CONFLICT'


def test_sem_sessao_nao_envia(client):
    resposta = client.post(
        '/api/v1/submissions', content=corpo_multipart(), headers={'Content-Type': MULTIPART}
    )
    assert resposta.status_code == 401


def test_exige_multipart(client):
    resposta = autenticado(client).post(
        '/api/v1/submissions', content=b'{}', headers={'Content-Type': 'application/json'}
    )
    assert resposta.status_code == 415
