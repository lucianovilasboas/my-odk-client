import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Conformidade entre o inventário (manifest.json) e os XML publicados no Central.
 *
 * Estes testes NÃO provam suporte do motor: provam que as fixtures descrevem
 * fielmente o que está publicado. Se o Central publicar outra versão e a
 * fixture for atualizada sem o manifesto, o teste falha.
 */

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', 'fixtures');
const manifest = JSON.parse(readFileSync(join(fixturesDir, 'manifest.json'), 'utf8'));

function xml(form) {
  return readFileSync(join(fixturesDir, form.fixture), 'utf8');
}

function count(xmlText, pattern) {
  return [...xmlText.matchAll(pattern)].length;
}

/** Desfaz as entidades XML usadas nas expressões, para comparar a lógica. */
function decode(text) {
  return text.replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
}

for (const form of manifest.forms) {
  test(`${form.xmlFormId} — fixture existe e tem a contagem de binds do manifesto`, () => {
    const text = xml(form);
    assert.ok(text.length > 0, 'fixture vazia');
    assert.equal(count(text, /<bind /g), form.binds, 'binds divergem do manifesto');
  });

  test(`${form.xmlFormId} — instâncias de CSV declaradas conferem com os anexos`, () => {
    const text = xml(form);
    const declaradas = [...text.matchAll(/<instance id="([^"]+)" src="jr:\/\/file-csv\/([^"]+)"\/>/g)]
      .map((m) => m[2])
      .sort();
    const anexos = form.attachments.map((a) => a.filename).sort();
    assert.deepEqual(declaradas, anexos, 'CSV declarado no XML difere dos anexos do manifesto');
  });

  test(`${form.xmlFormId} — entidades criadas conferem com o manifesto`, () => {
    const text = xml(form);
    const criadas = [...text.matchAll(/<entity dataset="([^"]+)" create="1"/g)].map((m) => m[1]);
    assert.deepEqual(criadas.sort(), [...form.createsEntities].sort());

    for (const dataset of criadas) {
      const bloco = text.split(`<entity dataset="${dataset}"`)[1]?.split('</entity>')[0] ?? '';
      const propriedades = count(bloco, /<property /g);
      assert.equal(
        propriedades,
        form.entityProperties.length,
        `propriedades da entidade ${dataset} divergem do manifesto`
      );
    }
  });
}

test('form_parte_1 — localização é geopoint, não texto convertido', () => {
  const text = xml(manifest.forms[0]);
  assert.match(
    text,
    /<bind nodeset="\/data\/preliminar\/localizacao" type="geopoint"/,
    'gps precisa serializar como geopoint'
  );
});

test('form_parte_1 — id da entidade é gerado uma única vez no primeiro carregamento', () => {
  const text = xml(manifest.forms[0]);
  assert.match(text, /<setvalue ref="\/data\/meta\/entity\/@id" event="odk-instance-first-load" value="uuid\(\)"\/>/);
  assert.equal(
    count(text, /odk-instance-first-load/g),
    1,
    'mais de um ponto de geração de UUID indica risco de id regenerado no restore'
  );
});

test('form_parte_1 — nome_agente resolve via instância secundária do CSV', () => {
  const text = decode(xml(manifest.forms[0]));
  assert.match(text, /instance\("Agentes"\)\/root\/item\[name=\s*\/data\/preliminar\/agente\s*\]\/Nome/);
});

test('form_parte_2 — pessoa_idosa e agente vêm de CSV, não da rede', () => {
  const text = decode(xml(manifest.forms[1]));
  for (const nome of ['Agentes', 'pessoas_idosas']) {
    assert.ok(
      text.includes(`<instance id="${nome}" src="jr://file-csv/${nome}.csv"/>`),
      `instância ${nome} não declarada`
    );
  }
  assert.match(text, /<itemset nodeset="instance\('pessoas_idosas'\)\/root\/item">/);
});

test('form_parte_2 — não cria entidades', () => {
  const text = xml(manifest.forms[1]);
  assert.equal(count(text, /<entity /g), 0);
});

test('fixtures de CSV são sintéticas e mantêm o cabeçalho original', () => {
  const agentes = readFileSync(join(fixturesDir, 'resources', 'Agentes.csv'), 'utf8').split('\n')[0];
  assert.equal(
    agentes.trim(),
    'name,label,__version,Bairro_Reside,Bairros,Codigo,E_mail,Funcao,Municipio,Nome,Realizou_Curso,Telefone,UF'
  );

  const pessoas = readFileSync(join(fixturesDir, 'resources', 'pessoas_idosas.csv'), 'utf8').split('\n')[0];
  assert.equal(
    pessoas.trim(),
    'name,label,__version',
    'a lista de entidades publicada hoje não carrega propriedades'
  );
});
