import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright-core';

/**
 * Gate ENGINE (PLAN.md §5.3) executado no motor oficial `@getodk/xforms-engine`
 * dentro do Chromium, com o corpus publicado.
 *
 * Provas:
 *  1. carga do XML real com os CSV locais, sem nenhuma chamada de rede;
 *  2. recurso ausente falha em vez de cair para a rede (fail-closed);
 *  3. nova instância gera o UUID da entidade uma única vez;
 *  4. restaurar a instância NÃO regenera esse UUID;
 *  5. `instance()` resolve valor do CSV e `jr:choice-name()` devolve o rótulo.
 */

const here = dirname(fileURLToPath(import.meta.url));
const raiz = join(here, '..', '..', '..', '..');
const bundle = join(here, '..', '..', 'harness', 'engine.bundle.js');

const fixture = (rel) => readFileSync(join(raiz, 'tests', 'fixtures', rel), 'utf8');

const corpus = {
  p1xml: fixture('xforms/form_parte_1.xml'),
  p2xml: fixture('xforms/form_parte_2.xml'),
  agentes: fixture('resources/Agentes.csv'),
  pessoas: fixture('resources/pessoas_idosas.csv'),
};

/** Sobe um contexto seguro (localhost) e injeta o bundle do motor. */
async function abrirHarness(t) {
  const bundleJs = readFileSync(bundle);
  const server = createServer((req, res) => {
    if (req.url === '/engine.bundle.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end(bundleJs);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      '<!doctype html><meta charset="utf-8"><title>gate</title>' +
        '<script type="module" src="/engine.bundle.js"></script>'
    );
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  // `crypto.randomUUID` exige contexto seguro: `localhost` serve, `about:blank` não.
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox'],
  });

  t.after(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => Boolean(window.OdkEngine), null, { timeout: 30_000 });

  return page;
}

/** Executa dentro da página; não tem acesso ao escopo do Node. */
async function rodarGate({ p1xml, p2xml, agentes, pessoas }) {
  const contador = { fetch: 0 };
  const fetchOriginal = window.fetch;

  window.fetch = async () => {
    contador.fetch += 1;
    throw new Error('rede proibida durante a coleta');
  };

  const anexos = { 'Agentes.csv': agentes, 'pessoas_idosas.csv': pessoas };

  const fetchFormAttachment = async (url) => {
    const nome = decodeURIComponent(String(url).split('/').pop());
    const conteudo = anexos[nome];
    return conteudo === undefined
      ? new Response('', { status: 404 })
      : new Response(conteudo, { status: 200, headers: { 'Content-Type': 'text/csv' } });
  };

  const idDaEntidade = (xml) => {
    const bloco = /<entity\b[^>]*>/.exec(xml);
    if (!bloco) return null;
    return (/\sid="([^"]+)"/.exec(bloco[0]) ?? [])[1] ?? null;
  };

  const resultado = {};
  try {
    const form1 = await OdkEngine.loadForm(p1xml, { fetchFormAttachment });
    resultado.statusP1 = form1.status;
    resultado.avisosP1 = form1.warnings;
    resultado.erroP1 = form1.error ? String(form1.error.message ?? form1.error) : null;

    const form2 = await OdkEngine.loadForm(p2xml, { fetchFormAttachment });
    resultado.statusP2 = form2.status;
    resultado.erroP2 = form2.error ? String(form2.error.message ?? form2.error) : null;

    const semAnexos = await OdkEngine.loadForm(p1xml, {
      fetchFormAttachment: async () => new Response('', { status: 404 }),
    });
    resultado.statusSemAnexos = semAnexos.status;

    if (form1.status !== 'failure') {
      const instancia = form1.createInstance();
      const payload = await instancia.root.prepareInstancePayload({ payloadType: 'monolithic' });
      const xml = await payload.data[0].get('xml_submission_file').text();
      resultado.entityIdCriado = idDaEntidade(xml);
      resultado.xmlCriado = xml;

      const restaurada = await form1.restoreInstance({ data: [payload.data[0]] });
      const payload2 = await restaurada.root.prepareInstancePayload({ payloadType: 'monolithic' });
      const xml2 = await payload2.data[0].get('xml_submission_file').text();
      resultado.entityIdRestaurado = idDaEntidade(xml2);
      resultado.instanceIdCriado = /<instanceID>([^<]*)<\/instanceID>/.exec(xml)?.[1] ?? null;
      resultado.instanceIdRestaurado = /<instanceID>([^<]*)<\/instanceID>/.exec(xml2)?.[1] ?? null;
    }
  } catch (error) {
    resultado.excecao = String(error?.stack ?? error);
  } finally {
    window.fetch = fetchOriginal;
  }

  resultado.fetchChamado = contador.fetch;
  return resultado;
}

/** Executa dentro da página: preenche valores e lê os cálculos. */
async function rodarPreenchimento({ p1xml, agentes }) {
  const fetchFormAttachment = async (url) =>
    decodeURIComponent(String(url).split('/').pop()) === 'Agentes.csv'
      ? new Response(agentes, { status: 200 })
      : new Response('', { status: 404 });

  const form = await OdkEngine.loadForm(p1xml, { fetchFormAttachment });
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

  const aguardarReatividade = () => new Promise((resolve) => setTimeout(resolve, 0));
  const valor = (nodeset) => porNodeset.get(nodeset)?.currentState?.value ?? null;

  const resultado = { nosetsEncontrados: porNodeset.size };

  // instance() — valor de outra coluna do CSV
  const agente = porNodeset.get('/data/preliminar/agente');
  resultado.opcoesAgente = (agente?.currentState?.valueOptions ?? []).map((i) => i.value);
  agente.selectValue('agente-teste-1');
  await aguardarReatividade();
  resultado.nomeAgente = valor('/data/preliminar/nome_agente');

  // jr:choice-name() — rótulo da opção escolhida
  const municipio = porNodeset.get('/data/preliminar/municipio');
  const opcao = (municipio?.currentState?.valueOptions ?? []).find(
    (i) => i.value !== 'outro-municipio'
  );
  municipio.selectValue(opcao.value);
  await aguardarReatividade();
  resultado.municipioEscolhido = opcao.value;
  resultado.municipioLabel = opcao.label.asString;
  resultado.municipioNome = valor('/data/preliminar/municipio_nome');

  return resultado;
}

test('gate ENGINE — carga offline, entidade e restauração (Chromium)', async (t) => {
  const page = await abrirHarness(t);
  const r = await page.evaluate(rodarGate, corpus);

  assert.equal(r.excecao, undefined, `exceção no harness: ${r.excecao}`);
  assert.equal(r.fetchChamado, 0, 'o motor não pode chamar fetch: todos os recursos são locais');

  assert.notEqual(r.statusP1, 'failure', `P1 não carregou: ${r.erroP1}`);
  assert.notEqual(r.statusP2, 'failure', `P2 não carregou: ${r.erroP2}`);

  assert.equal(
    r.statusSemAnexos,
    'failure',
    'sem o CSV do pacote, o motor precisa falhar em vez de buscar fora'
  );

  assert.match(r.entityIdCriado ?? '', /^[0-9a-f-]{36}$/i, 'UUID da entidade não foi gerado');

  const entidade = /<entity\b[^>]*>/.exec(r.xmlCriado)?.[0] ?? '';
  assert.match(entidade, /dataset="pessoas_idosas"/);
  // O motor escreve `create="true"`; o pyxform publica `create="1"`. Ambos são o
  // mesmo booleano XPath, mas a aceitação pelo Central precisa ser verificada.
  assert.match(entidade, /create="(1|true)"/);

  assert.equal(
    r.entityIdRestaurado,
    r.entityIdCriado,
    'restaurar a instância regenerou o UUID da entidade e criaria uma entidade duplicada'
  );
  assert.equal(
    r.instanceIdRestaurado,
    r.instanceIdCriado,
    'restaurar a instância regenerou o instanceID'
  );
});

test('gate ENGINE — instance() e jr:choice-name() com valores preenchidos', async (t) => {
  const page = await abrirHarness(t);
  const r = await page.evaluate(rodarPreenchimento, corpus);

  assert.deepEqual(r.opcoesAgente, ['agente-teste-1', 'agente-teste-2']);

  assert.equal(
    r.nomeAgente,
    'Agente Teste 1',
    'instance()/root/item[name=...]/Nome não resolveu a coluna Nome do CSV'
  );

  assert.notEqual(r.municipioEscolhido, 'outro-municipio');
  assert.equal(
    r.municipioNome,
    r.municipioLabel,
    'jr:choice-name() não devolveu o rótulo da escolha de município'
  );
});
