from .conftest import qr_url


def autenticado(client):
    assert client.post('/api/v1/connections', json={'qr': qr_url()}).status_code == 200
    return client


def test_lista_formularios_sem_token_nas_urls(client):
    resposta = autenticado(client).get('/api/v1/forms')
    assert resposta.status_code == 200
    formularios = resposta.json()['forms']
    assert [f['xmlFormId'] for f in formularios] == ['form_parte_1', 'form_parte_2']
    assert 'key/' not in resposta.text


def test_pacote_traz_xml_e_recursos(client):
    resposta = autenticado(client).get('/api/v1/forms/form_parte_1/package')
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo['xmlFormId'] == 'form_parte_1'
    assert '<h:html' in corpo['xml']
    assert corpo['resources'][0]['filename'] == 'Agentes.csv'


def test_recurso_devolve_bytes(client):
    resposta = autenticado(client).get('/api/v1/forms/form_parte_1/resources/Agentes.csv')
    assert resposta.status_code == 200
    assert resposta.headers['content-type'].startswith('text/csv')
    assert b'name,label' in resposta.content


def test_recurso_com_travessia_e_recusado(client):
    for nome in ['..%2Fetc%2Fpasswd', 'a%5Cb', 'x..y']:
        resposta = autenticado(client).get(f'/api/v1/forms/form_parte_1/resources/{nome}')
        assert resposta.status_code in (400, 404)


def test_sem_sessao_nao_lista(client):
    assert client.get('/api/v1/forms').status_code == 401
