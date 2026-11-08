import test from 'node:test';
import assert from 'node:assert/strict';

import { createResourceResolver } from '../src/resource-resolver.js';

/**
 * Testes de contrato da resolução de recursos do pacote (PLAN.md §5.3 itens 5 e
 * 7, §8.1 item 7). A rede é espionada no próprio ambiente: se qualquer código
 * chamar `fetch` durante a resolução, o teste falha.
 */

const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function pacote() {
  return {
    resources: [
      {
        path: 'media/logo.png',
        mime: 'image/png',
        bytes: BYTES,
        digest: 'sha256:exemplo',
      },
    ],
  };
}

/** Substitui `fetch` por um espião e devolve o contador de chamadas. */
function espionarRede(t) {
  const original = globalThis.fetch;
  const contador = { chamadas: 0 };

  globalThis.fetch = async () => {
    contador.chamadas += 1;
    throw new Error('rede proibida durante a coleta');
  };
  t.after(() => {
    globalThis.fetch = original;
  });

  return contador;
}

test('F1.4 — recurso do pacote resolve sem nenhuma chamada de rede', async (t) => {
  const rede = espionarRede(t);
  const resolver = await createResourceResolver(pacote());

  const recurso = await resolver.resolve('media/logo.png');

  assert.equal(rede.chamadas, 0, 'a coleta não pode buscar recurso na rede');
  assert.deepEqual(recurso.bytes, BYTES);
  assert.equal(recurso.mime, 'image/png');
});

test('§8.1.4 — recurso ausente falha em vez de cair para a rede', async (t) => {
  const rede = espionarRede(t);
  const resolver = await createResourceResolver(pacote());

  await assert.rejects(
    () => resolver.resolve('media/inexistente.png'),
    (error) => error.code === 'RESOURCE_MISSING'
  );
  assert.equal(rede.chamadas, 0);
});

test('§12 — caminho com travessia é recusado', async () => {
  const resolver = await createResourceResolver(pacote());

  for (const caminho of ['../segredo.json', '/etc/passwd', 'media/../x.png', 'file:///x.png']) {
    await assert.rejects(
      () => resolver.resolve(caminho),
      (error) => error.code === 'RESOURCE_PATH_INVALID',
      `caminho deveria ser recusado: ${caminho}`
    );
  }
});

test('§8.1.4 — pacote com recurso duplicado é recusado na construção', async () => {
  const duplicado = pacote();
  duplicado.resources.push({ ...duplicado.resources[0] });

  await assert.rejects(
    () => createResourceResolver(duplicado),
    (error) => error.code === 'RESOURCE_DUPLICATED'
  );
});
