import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import 'fake-indexeddb/auto';

import { createDraftStore } from '../src/draft-store.js';

/**
 * Testes de contrato do rascunho durável (PLAN.md §5.3 itens 3 e 6, §8.2).
 *
 * Rodam sobre IndexedDB via `fake-indexeddb`: provam a lógica transacional e as
 * invariantes. A durabilidade em aparelho real (encerrar, reiniciar, cota) é
 * medida no gate offline, não aqui.
 */

function draft() {
  return {
    localId: 'draft-1',
    instanceID: 'uuid:6f1d8f0e-2a3b-4c5d-8e9f-0a1b2c3d4e5f',
    xmlFormId: 'spike_minimo',
    packageId: 'pkg-1',
    revision: 1,
    answers: { nome: 'Ana', idade: '34' },
  };
}

test('F1.3 — rascunho sobrevive a fechar e reabrir o aplicativo', async () => {
  const databaseName = `spike-${randomUUID()}`;

  const first = await createDraftStore({ databaseName });
  await first.save(draft());
  await first.close();

  const reopened = await createDraftStore({ databaseName });
  const restored = await reopened.load('draft-1');
  await reopened.close();

  assert.ok(restored, 'rascunho deveria existir após reabertura');
  assert.deepEqual(restored.answers, draft().answers);
  assert.equal(restored.revision, 1);
});

test('F1.3 — restaurar não regenera instanceID nem invalida a revisão', async () => {
  const databaseName = `spike-${randomUUID()}`;

  const store = await createDraftStore({ databaseName });
  const original = await store.save(draft());
  await store.close();

  const reopened = await createDraftStore({ databaseName });
  const restored = await reopened.load('draft-1');
  await reopened.close();

  assert.equal(restored.instanceID, draft().instanceID);
  assert.equal(original.instanceID, restored.instanceID);
});

test('§7.2.1 — salvamento só conta após commit de respostas e anexos', async () => {
  const databaseName = `spike-${randomUUID()}`;
  const store = await createDraftStore({ databaseName });

  const comAnexoNaoPersistido = {
    ...draft(),
    answers: { nome: 'Ana', foto: 'foto-1.jpg' },
    attachments: [
      { name: 'foto-1.jpg', mime: 'image/jpeg', bytes: null, digest: null },
    ],
  };

  await assert.rejects(
    () => store.save(comAnexoNaoPersistido),
    (error) => error.code === 'ATTACHMENT_MISSING',
    'rascunho com anexo sem bytes persistidos não pode ser dado como salvo'
  );

  assert.equal(
    await store.load('draft-1'),
    null,
    'nada parcial pode ficar salvo'
  );
});

test('T07 — falta de espaço não pode ser reportada como sucesso', async () => {
  const databaseName = `spike-${randomUUID()}`;
  const store = await createDraftStore({
    databaseName,
    faultInjection: { failWriteOnce: 'quota' },
  });

  await assert.rejects(
    () => store.save(draft()),
    (error) => error.code === 'QUOTA_EXCEEDED'
  );

  assert.equal(
    await store.load('draft-1'),
    null,
    'estado anterior deve permanecer íntegro e sem escrita parcial'
  );
});
