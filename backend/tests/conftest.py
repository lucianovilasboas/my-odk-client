import base64

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.settings import Settings

HOST = 'odk.exemplo.test'
PROJECT = '14'
TOKEN = 'tok-De-Teste-123'
SECRET = base64.b64encode(b'0' * 32).decode()


def qr_url(host: str = HOST, project: str = PROJECT, token: str = TOKEN) -> str:
    return f'https://{host}/v1/key/{token}/projects/{project}'


@pytest.fixture
def settings() -> Settings:
    return Settings(
        session_secret=base64.b64decode(SECRET),
        allowed_hosts=(HOST,),
        allowed_projects=(PROJECT,),
        cookie_secure=False,
        session_ttl_seconds=3600,
    )


FORM_LIST = """<?xml version="1.0" encoding="UTF-8"?>
<xforms xmlns="http://openrosa.org/xforms/xformsList">
  <xform>
    <formID>form_parte_1</formID>
    <name>Formulário - Parte 1</name>
    <version>1</version>
    <hash>md5:aaa</hash>
    <downloadUrl>https://x/forms/form_parte_1.xml</downloadUrl>
  </xform>
  <xform>
    <formID>form_parte_2</formID>
    <name>Formulário - Parte 2</name>
    <version>1</version>
    <hash>md5:bbb</hash>
  </xform>
</xforms>"""

MANIFEST = """<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://openrosa.org/xforms/xformsManifest">
  <mediaFile>
    <filename>Agentes.csv</filename>
    <hash>md5:ccc</hash>
    <downloadUrl>https://x/attachments/Agentes.csv</downloadUrl>
  </mediaFile>
</manifest>"""

FORM_XML = '<?xml version="1.0"?><h:html xmlns:h="http://www.w3.org/1999/xhtml"><h:head/></h:html>'


def central_handler(request: httpx.Request) -> httpx.Response:
    caminho = request.url.path
    if caminho.endswith('/formList'):
        if 'tok-invalido' in caminho:
            return httpx.Response(401, json={'code': 401.2})
        return httpx.Response(200, content=FORM_LIST.encode())
    if caminho.endswith('.xml'):
        return httpx.Response(200, content=FORM_XML.encode())
    if caminho.endswith('/manifest'):
        return httpx.Response(200, content=MANIFEST.encode())
    if '/attachments/' in caminho:
        nome = caminho.rsplit('/', 1)[-1]
        if nome == 'grande.csv':
            return httpx.Response(200, content=b'x' * 10)
        return httpx.Response(200, content=b'name,label\n1,dois\n', headers={'content-type': 'text/csv'})
    if caminho.endswith('/submission'):
        return httpx.Response(201, content=b'<OpenRosaResponse/>')
    return httpx.Response(404)


@pytest.fixture
def client(settings: Settings):
    app.state.settings = settings
    app.state.central_transport = httpx.MockTransport(central_handler)
    with TestClient(app) as c:
        yield c
    app.state.settings = None
    app.state.central_transport = None
