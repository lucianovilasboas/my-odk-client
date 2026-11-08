#!/usr/bin/env node
/**
 * Smoke test manual contra o ODK Central (escreve de verdade).
 *
 * Gera uma submissão sintética da `form_parte_1` com o motor oficial, envia ao
 * projeto configurado e verifica se o `pessoas_idosas.csv` foi regenerado.
 *
 * Requer autorização explícita: este script grava no servidor. Nunca rodar em CI.
 *
 *   CENTRAL_TOKEN_FILE=forms/.app_user node scripts/central-smoke.mjs --confirm
 *
 * A credencial é lida do arquivo (QR de configuração do Collect ou token puro) e
 * nunca é impressa. O registro criado é marcado com "TESTE CLIENTE WEB - APAGAR".
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = join(here, '..', '..', '..');
const bundle = join(here, '..', 'harness', 'engine.bundle.js');
const MARCADOR = 'TESTE CLIENTE WEB - APAGAR';

if (!process.argv.includes('--confirm')) {
  console.error('Este script escreve no Central. Repita com --confirm.');
  process.exit(1);
}

/** Aceita token puro ou o QR comprimido do Collect. */
function lerToken() {
  const arquivo = process.env.CENTRAL_TOKEN_FILE ?? join(raiz, 'forms', '.app_user');
  const bruto = readFileSync(arquivo, 'utf8').trim();
  if (/^[A-Za-z0-9!_-]{40,}$/.test(bruto)) return bruto;

  const json = JSON.parse(inflateSync(Buffer.from(bruto, 'base64')).toString('utf8'));
  return json.general.server_url.split('/v1/key/')[1].split('/')[0];
}

const token = lerToken();
const host = process.env.CENTRAL_HOST ?? 'https://odk.lucianovilasboas.com.br';
const projeto = process.env.CENTRAL_PROJECT ?? '14';
const base = `${host}/v1/key/${token}/projects/${projeto}`;

const p1xml = readFileSync(join(raiz, 'tests', 'fixtures', 'xforms', 'form_parte_1.xml'), 'utf8');
const agentes = readFileSync(join(raiz, 'tests', 'fixtures', 'resources', 'Agentes.csv'), 'utf8');

async function iniciarHarness() {
  const bundleJs = readFileSync(bundle);
  const server = createServer((req, res) => {
    if (req.url === '/engine.bundle.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(bundleJs);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><meta charset="utf-8"><script type="module" src="/engine.bundle.js"></script>');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => Boolean(window.OdkEngine), null, { timeout: 30_000 });

  return {
    page,
    async encerrar() {
      await browser.close();
      await new Promise((r) => server.close(r));
    },
  };
}

/** Monta a submissão mínima válida: respondente recusou, então a entrevista não é exigida. */
async function montarSubmissao(page) {
  return page.evaluate(
    async ({ p1xml, agentes, marcador }) => {
      const form = await OdkEngine.loadForm(p1xml, {
        fetchFormAttachment: async (url) =>
          String(url).includes('Agentes.csv')
            ? new Response(agentes, { status: 200 })
            : new Response('', { status: 404 }),
      });
      if (form.status === 'failure') throw new Error(`formulário não carregou: ${form.error?.message}`);

      const instancia = form.createInstance();
      const todos = [];
      const visitar = (node) => {
        todos.push(node);
        const filhos = node.currentState?.children ?? node.children;
        if (filhos) for (const filho of filhos) visitar(filho);
      };
      visitar(instancia.root);

      const porNodeset = new Map(
        todos.filter((n) => n.definition?.nodeset).map((n) => [n.definition.nodeset, n])
      );
      const no = (ns) => {
        const n = porNodeset.get(ns);
        if (!n) throw new Error(`nó não encontrado: ${ns}`);
        return n;
      };
      const primeiraOpcao = (ns, ignorar) =>
        no(ns).currentState.valueOptions.find((i) => i.value !== ignorar).value;

      no('/data/preliminar/agente').selectValue(
        no('/data/preliminar/agente').currentState.valueOptions[0].value
      );
      no('/data/preliminar/bairro').setValue('Bairro Teste');
      no('/data/preliminar/nome_pessoa_idosa').setValue(marcador);
      no('/data/preliminar/uf').selectValue(primeiraOpcao('/data/preliminar/uf'));
      no('/data/preliminar/municipio').selectValue(
        primeiraOpcao('/data/preliminar/municipio', 'outro-municipio')
      );
      no('/data/preliminar/endereco').setValue('Rua Teste, 0');
      no('/data/preliminar/respondente').selectValue('recusou_responder');

      await new Promise((r) => setTimeout(r, 0));

      const payload = await instancia.root.prepareInstancePayload({ payloadType: 'monolithic' });
      const xml = await payload.data[0].get('xml_submission_file').text();
      return { xml, status: payload.status, violacoes: payload.violations?.length ?? 0 };
    },
    { p1xml, agentes, marcador: MARCADOR }
  );
}

async function enviar(xml) {
  const corpo = new FormData();
  corpo.append('xml_submission_file', new Blob([xml], { type: 'text/xml' }), 'submission.xml');

  const resposta = await fetch(`${base}/submission`, {
    method: 'POST',
    headers: { 'X-OpenRosa-Version': '1.0' },
    body: corpo,
  });

  return { status: resposta.status, texto: (await resposta.text()).slice(0, 400) };
}

async function lerPessoas() {
  const resposta = await fetch(`${base}/forms/form_parte_2/attachments/pessoas_idosas.csv`, {
    headers: { 'X-OpenRosa-Version': '1.0' },
  });
  if (!resposta.ok) return { ok: false, status: resposta.status };
  const texto = await resposta.text();
  return { ok: true, linhas: texto.trim().split('\n').length - 1, contemMarcador: texto.includes(MARCADOR) };
}

const harness = await iniciarHarness();
try {
  const antes = await lerPessoas();
  const { xml, status, violacoes } = await montarSubmissao(harness.page);
  console.log(`payload: ${status}, violações: ${violacoes}, ${xml.length} bytes`);
  console.log(`entidades antes: ${antes.linhas}`);

  const envio = await enviar(xml);
  console.log(`POST /submission → ${envio.status}`);
  if (envio.status !== 201) {
    console.log(envio.texto);
    process.exitCode = 1;
  } else {
    let depois;
    for (let tentativa = 0; tentativa < 15; tentativa += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      depois = await lerPessoas();
      if (depois.contemMarcador) break;
    }
    console.log(`entidades depois: ${depois?.linhas} | contém o registro de teste: ${depois?.contemMarcador}`);
    if (!depois?.contemMarcador) {
      console.log('A entidade não apareceu no CSV da Parte 2 dentro do prazo.');
      process.exitCode = 1;
    }
  }
} finally {
  await harness.encerrar();
}
