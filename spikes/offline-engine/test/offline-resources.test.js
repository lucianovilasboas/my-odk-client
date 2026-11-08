import test from 'node:test';
import assert from 'node:assert/strict';

import { createResourceResolver } from '../src/resource-resolver.js';

/**
 * Testes de contrato da resolução de recursos do pacote (PLAN.md §5.3 item 7,
 * §8.1). Estado esperado hoje: VERMELHO (F1.4).
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

function redeProibida() {
  const contador = { chamadas: 0 };
  return {
    contador,
    fetchImpl: async () => {
      contador.chamadas += 1;
      throw new Error('rede proibida durante a coleta');
    },
  };
}

test('F1.4 — recurso do pacote resolve sem nenhuma chamada de rede', async () => {
  const { contador, fetchImpl } = redeProibida();
  const resolver = await createResourceResolver({ ...pacote(), fetchImpl });

  const recurso = await resolver.resolve('media/logo.png');

  assert.equal(contador.chamadas, 0, 'a coleta não pode buscar recurso na rede');
  assert.deepEqual(recurso.bytes, BYTES);
  assert.equal(recurso.mime, 'image/png');
});

test('§8.1.4 — recurso ausente falha em vez de cair para a rede', async () => {
  const { contador, fetchImpl } = redeProibida();
  const resolver = await createResourceResolver({ ...pacote(), fetchImpl });

  await assert.rejects(
    () => resolver.resolve('media/inexistente.png'),
    (error) => error.code === 'RESOURCE_MISSING'
  );
  assert.equal(contador.chamadas, 0);
});

test('§12 — caminho com travessia é recusado', async () => {
  const { fetchImpl } = redeProibida();
  const resolver = await createResourceResolver({ ...pacote(), fetchImpl });

  for (const caminho of ['../segredo.json', '/etc/passwd', 'media/../x.png']) {
    await assert.rejects(
      () => resolver.resolve(caminho),
      (error) => error.code === 'RESOURCE_PATH_INVALID',
      `caminho deveria ser recusado: ${caminho}`
    );
  }
});
