/**
 * Resolução de recursos do pacote de campo — contrato mínimo do spike (Fase 1).
 *
 * Exigência do PLAN.md:
 * - §5.3 item 5 / §8.1 item 7: o preenchimento não busca recurso na rede. Todo
 *   recurso referenciado precisa estar no pacote local.
 * - §5.3 item 7: a resolução fica sob nosso controle, não do motor.
 * - §12: caminho lógico não confiável — `..` e caminho absoluto são recusados.
 *
 * NÃO IMPLEMENTADO. Existe apenas para tornar verdes os testes de
 * `test/offline-resources.test.js`.
 */

/**
 * @typedef {Object} PackageResource
 * @property {string} path   Caminho lógico dentro do pacote (ex.: `media/logo.png`).
 * @property {string} mime
 * @property {Uint8Array} bytes
 * @property {string} digest SHA-256 do conteúdo, conferido no download.
 */

/**
 * @typedef {Object} ResourceResolver
 * @property {(path: string) => Promise<PackageResource>} resolve
 *   Resolve apenas a partir do pacote local. Rejeita com
 *   `error.code === 'RESOURCE_MISSING'` quando o recurso não está no pacote e
 *   com `error.code === 'RESOURCE_PATH_INVALID'` quando o caminho é inválido.
 */

/**
 * @param {object} options
 * @param {PackageResource[]} options.resources Conteúdo do pacote local.
 * @param {(input: string) => Promise<unknown>} [options.fetchImpl]
 *   Injetável apenas para provar que não é chamado durante a coleta.
 * @returns {Promise<ResourceResolver>}
 */
export async function createResourceResolver() {
  const error = new Error(
    'Não implementado (F1.4): resolver recursos do pacote sem acesso à rede. ' +
      'Ver PLAN.md §15, Fase 1.'
  );
  error.code = 'NOT_IMPLEMENTED';
  throw error;
}
