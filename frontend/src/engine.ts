/**
 * Adaptador do motor XForms.
 *
 * Usamos `@getodk/xforms-engine` diretamente, e não o componente pronto
 * `@getodk/web-forms`, porque ele não expõe a instância: sem acesso à instância
 * não existe autosave nem rascunho recuperável, que são o requisito principal
 * do projeto (PLAN.md §5.3 item 6, §8.2).
 */

import {
  loadForm,
  type AnyNode,
  type FormInstance,
  type InstancePayload,
} from '@getodk/xforms-engine'

export type ResolverRecurso = (caminho: string) => Uint8Array | null

export type AnyFormInstance = FormInstance<'create'> | FormInstance<'restore'>

export interface FormularioCarregado {
  xmlFormId: string
  instancia: FormInstance<'create'>
}

/** Resolve `jr://file-csv/Nome.csv` a partir do pacote local, sem rede. */
export function resolverDoPacote(recursos: Map<string, Uint8Array>) {
  return async (url: unknown): Promise<Response> => {
    const caminho = String(url)
    const nome = decodeURIComponent(caminho.split('/').pop() ?? '')
    const conteudo = recursos.get(nome)
    if (!conteudo) {
      return new Response('', { status: 404 })
    }
    return new Response(conteudo as unknown as BodyInit, { status: 200 })
  }
}

export async function carregar(
  xml: string,
  recursos: Map<string, Uint8Array>,
): Promise<FormularioCarregado> {
  const resultado = await loadForm(xml, { fetchFormAttachment: resolverDoPacote(recursos) })

  if (resultado.status === 'failure') {
    throw new Error(`formulário não pôde ser carregado: ${resultado.error?.message ?? 'motivo desconhecido'}`)
  }

  return { xmlFormId: '', instancia: resultado.createInstance() }
}

export async function restaurar(
  xml: string,
  recursos: Map<string, Uint8Array>,
  payloadXml: string,
): Promise<FormInstance<'restore'>> {
  const resultado = await loadForm(xml, { fetchFormAttachment: resolverDoPacote(recursos) })
  if (resultado.status === 'failure') {
    throw new Error(`formulário não pôde ser carregado: ${resultado.error?.message ?? ''}`)
  }

  const dados = new FormData()
  dados.append('xml_submission_file', new Blob([payloadXml], { type: 'text/xml' }), 'submission.xml')
  return resultado.restoreInstance({ data: [dados as never] })
}

/** Percorre a árvore de nós, que o motor expõe em `currentState.children`. */
export function achatar(raiz: AnyNode): AnyNode[] {
  const todos: AnyNode[] = []
  const visitar = (no: AnyNode) => {
    todos.push(no)
    const filhos = (no as { currentState?: { children?: AnyNode[] | null } }).currentState?.children
    if (filhos) for (const filho of filhos) visitar(filho)
  }
  visitar(raiz)
  return todos
}

export function porNodeset(raiz: AnyNode): Map<string, AnyNode> {
  const indice = new Map<string, AnyNode>()
  for (const no of achatar(raiz)) {
    const nodeset = (no as { definition?: { nodeset?: string } }).definition?.nodeset
    if (nodeset) indice.set(nodeset, no)
  }
  return indice
}

export async function serializar(instancia: AnyFormInstance): Promise<string> {
  const payload: InstancePayload<'monolithic'> = await instancia.root.prepareInstancePayload({
    payloadType: 'monolithic',
  })
  const arquivo = payload.data[0].get('xml_submission_file') as File
  return arquivo.text()
}

export function comoFormData(xml: string): FormData {
  const dados = new FormData()
  dados.append('xml_submission_file', new Blob([xml], { type: 'text/xml' }), 'submission.xml')
  return dados
}
