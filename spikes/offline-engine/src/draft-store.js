/**
 * Repositório local de rascunhos — contrato mínimo do spike da Fase 1.
 *
 * Exigências do PLAN.md que este módulo representa:
 * - §5.3 item 3: restaurar rascunho sem regenerar `instanceID`, defaults ou
 *   cálculos temporais.
 * - §5.3 item 6: expor captura de alterações para autosave, sem depender do
 *   evento final de envio.
 * - §8.2: foto só conta como anexada depois de persistir bytes e referência.
 * - §7.2 invariante 1: "salvo" só aparece após commit local concluído.
 *
 * NÃO IMPLEMENTADO. A implementação depende da decisão registrada em
 * `docs/adr/0001-engine-and-platform.md` e existe apenas para tornar verdes os
 * testes de `test/draft-restore.test.js`.
 */

/**
 * @typedef {Object} AttachmentRef
 * @property {string} name            Nome lógico referenciado no XML.
 * @property {string} mime
 * @property {Uint8Array|null} bytes  `null` significa: bytes nunca persistidos.
 * @property {string|null} digest     SHA-256 do conteúdo, quando houver bytes.
 */

/**
 * @typedef {Object} Draft
 * @property {string} localId
 * @property {string} instanceID      Identidade estável da submissão.
 * @property {string} xmlFormId
 * @property {string} packageId       Geração do pacote usada na coleta.
 * @property {number} revision        Cresce a cada commit bem-sucedido.
 * @property {Record<string, string>} answers
 * @property {AttachmentRef[]} [attachments]
 */

/**
 * @typedef {Object} DraftStore
 * @property {(draft: Draft) => Promise<Draft>} save
 *   Commit transacional. Só resolve depois que respostas e anexos estão
 *   gravados. Rejeita com `error.code === 'ATTACHMENT_MISSING'` se o rascunho
 *   referenciar anexo sem bytes persistidos; rejeita com
 *   `error.code === 'QUOTA_EXCEEDED'` sem deixar estado parcial.
 * @property {(localId: string) => Promise<Draft|null>} load
 * @property {() => Promise<Draft[]>} list
 * @property {() => Promise<void>} close
 */

/**
 * Abre (ou cria) o repositório local de rascunhos.
 *
 * @param {object} [options]
 * @param {string} [options.databaseName]
 *   Define o banco aberto. Reabrir com o mesmo nome simula fechar e reabrir o
 *   aplicativo no mesmo dispositivo.
 * @param {{ failWriteOnce?: 'quota' }} [options.faultInjection]
 *   Costura exclusiva de teste para simular falta de espaço (T06/T07, §17.1).
 *   Não deve ser usada pelo código de produção.
 * @returns {Promise<DraftStore>}
 */
export async function createDraftStore() {
  const error = new Error(
    'Não implementado (F1.5): persistir rascunho e anexo de forma transacional. ' +
      'Ver PLAN.md §15, Fase 1, e docs/adr/0001-engine-and-platform.md.'
  );
  error.code = 'NOT_IMPLEMENTED';
  throw error;
}
