/**
 * Resolução de recursos do pacote de campo — Fase 1 (PLAN.md §5.3 itens 5 e 7,
 * §8.1 item 7).
 *
 * Regra central: durante a coleta não existe rede. Todo recurso referenciado por
 * um formulário tem de estar no pacote local; se não estiver, a coleta daquele
 * formulário é bloqueada em vez de buscar silenciosamente fora.
 */

/** @typedef {{ path: string, mime: string, bytes: Uint8Array, digest: string }} PackageResource */

/**
 * Caminho lógico aceitável: relativo, sem `..`, sem raiz absoluta, sem esquema
 * de URL e sem separador do Windows.
 *
 * @param {string} path
 */
function assertValidPath(path) {
  const invalido =
    typeof path !== 'string' ||
    path.trim() === '' ||
    path.startsWith('/') ||
    path.startsWith('\\') ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path) ||
    path.includes('\\') ||
    path.split('/').includes('..');
  if (invalido) {
    const error = new Error(`Caminho de recurso inválido: ${String(path)}`);
    error.code = 'RESOURCE_PATH_INVALID';
    throw error;
  }
}

/**
 * @param {{ resources?: PackageResource[] }} [options]
 * @returns {Promise<{ resolve: (path: string) => Promise<PackageResource> }>}
 */
export async function createResourceResolver({ resources = [] } = {}) {
  /** @type {Map<string, PackageResource>} */
  const index = new Map();

  for (const resource of resources) {
    assertValidPath(resource.path);
    if (index.has(resource.path)) {
      const error = new Error(`Recurso duplicado no pacote: ${resource.path}`);
      error.code = 'RESOURCE_DUPLICATED';
      throw error;
    }
    index.set(resource.path, resource);
  }

  return {
    async resolve(path) {
      assertValidPath(path);
      const resource = index.get(path);
      if (!resource) {
        const error = new Error(`Recurso ausente no pacote: ${path}`);
        error.code = 'RESOURCE_MISSING';
        throw error;
      }
      return resource;
    },
  };
}
