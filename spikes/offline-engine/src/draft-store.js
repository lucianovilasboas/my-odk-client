/**
 * Repositório local de rascunhos — Fase 1 (PLAN.md §5.3 itens 3 e 6, §8.2, §7.2).
 *
 * Implementado sobre IndexedDB: respostas e anexos são gravados na mesma
 * transação, de modo que "salvo" só aparece quando tudo está no disco. Esta
 * implementação é a prova de contrato; a durabilidade em dispositivo real
 * (encerrar, reiniciar, pressão de cota) é medida no gate offline.
 *
 * @typedef {{ name: string, mime: string, bytes: Uint8Array|null, digest: string|null }} AttachmentRef
 * @typedef {{
 *   localId: string,
 *   instanceID: string,
 *   xmlFormId: string,
 *   packageId: string,
 *   revision: number,
 *   answers: Record<string, string>,
 *   attachments?: AttachmentRef[]
 * }} Draft
 */

const DB_VERSION = 1;
const DRAFTS = 'drafts';
const ATTACHMENTS = 'attachments';

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/** @param {unknown} cause */
function mapWriteError(cause) {
  if (cause && cause.name === 'QuotaExceededError') {
    return fail('QUOTA_EXCEEDED', 'Sem espaço no aparelho; nada foi gravado.');
  }
  return cause;
}

function openDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFTS)) {
        db.createObjectStore(DRAFTS, { keyPath: 'localId' });
      }
      if (!db.objectStoreNames.contains(ATTACHMENTS)) {
        const store = db.createObjectStore(ATTACHMENTS, { keyPath: ['localId', 'name'] });
        store.createIndex('byLocalId', 'localId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(mapWriteError(request.error));
  });
}

function runTransaction(db, stores, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(mapWriteError(tx.error));
    tx.onabort = () => reject(mapWriteError(tx.error ?? new Error('transação abortada')));

    try {
      work(tx);
    } catch (cause) {
      try {
        tx.abort();
      } catch {
        // transação já encerrada
      }
      reject(cause);
    }
  });
}

/**
 * O anexo só entra no rascunho depois de existir como bytes com digest. Um
 * rascunho que referencia anexo não persistido nunca pode ser dado como salvo
 * (§8.2; invariante 3 de §7.2).
 *
 * @param {AttachmentRef[]} attachments
 */
function assertAttachmentsPersistable(attachments) {
  for (const attachment of attachments) {
    const persistido =
      attachment?.bytes instanceof Uint8Array && attachment.bytes.byteLength > 0 && attachment.digest;
    if (!persistido) {
      throw fail(
        'ATTACHMENT_MISSING',
        `Anexo sem bytes persistidos: ${attachment?.name ?? 'sem nome'}`
      );
    }
  }
}

/**
 * @param {{
 *   databaseName?: string,
 *   faultInjection?: { failWriteOnce?: 'quota' }
 * }} [options]
 *   `faultInjection` é costura exclusiva de teste (T06/T07, §17.1). Produção não usa.
 */
export async function createDraftStore({ databaseName = 'odk-drafts', faultInjection } = {}) {
  const db = await openDatabase(databaseName);

  return {
    async save(draft) {
      const attachments = draft.attachments ?? [];
      assertAttachmentsPersistable(attachments);

      if (faultInjection?.failWriteOnce === 'quota') {
        faultInjection.failWriteOnce = undefined;
        throw fail('QUOTA_EXCEEDED', 'Sem espaço no aparelho; nada foi gravado.');
      }

      const record = { ...draft, revision: draft.revision ?? 1 };

      await runTransaction(db, [DRAFTS, ATTACHMENTS], 'readwrite', (tx) => {
        tx.objectStore(DRAFTS).put(record);
        const store = tx.objectStore(ATTACHMENTS);
        for (const attachment of attachments) {
          store.put({ localId: record.localId, ...attachment });
        }
      });

      return record;
    },

    async load(localId) {
      const draft = await new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFTS, 'readonly');
        const request = tx.objectStore(DRAFTS).get(localId);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(mapWriteError(request.error));
      });

      if (!draft) return null;

      const attachments = await new Promise((resolve, reject) => {
        const tx = db.transaction(ATTACHMENTS, 'readonly');
        const request = tx.objectStore(ATTACHMENTS).index('byLocalId').getAll(localId);
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(mapWriteError(request.error));
      });

      return { ...draft, attachments };
    },

    async list() {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFTS, 'readonly');
        const request = tx.objectStore(DRAFTS).getAll();
        request.onsuccess = () => resolve(request.result ?? []);
        request.onerror = () => reject(mapWriteError(request.error));
      });
    },

    async close() {
      db.close();
    },
  };
}
