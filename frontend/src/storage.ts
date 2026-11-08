/**
 * Armazenamento local da PWA.
 *
 * Uma base por `workspaceId` (ADR 0003): trocar de agente no mesmo aparelho não
 * expõe rascunhos, pacotes ou fila do anterior.
 */

const VERSAO = 1

export interface Formulario {
  xmlFormId: string
  name: string
  version: string
  hash: string
}

export interface Pacote {
  xmlFormId: string
  xml: string
  recursos: { nome: string; bytes: Uint8Array }[]
  preparadoEm: number
}

export interface Rascunho {
  localId: string
  xmlFormId: string
  instanceID: string
  revisao: number
  xml: string
  atualizadoEm: number
}

export interface ItemFila {
  localId: string
  xmlFormId: string
  xml: string
  estado: 'pendente' | 'enviando' | 'confirmado' | 'erro'
  tentativas: number
  ultimoErro?: string
  atualizadoEm: number
}

export type Base = ReturnType<typeof abrirBase>

function pedir<T>(requisicao: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    requisicao.onsuccess = () => resolve(requisicao.result)
    requisicao.onerror = () => reject(requisicao.error)
  })
}

function transacao(db: IDBDatabase, lojas: string[], modo: IDBTransactionMode, trabalho: (tx: IDBTransaction) => void) {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(lojas, modo)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('transação abortada'))
    try {
      trabalho(tx)
    } catch (erro) {
      tx.abort()
      reject(erro)
    }
  })
}

export function abrirBase(workspaceId: string) {
  const nome = `odk-${workspaceId}`

  const pronto = new Promise<IDBDatabase>((resolve, reject) => {
    const requisicao = indexedDB.open(nome, VERSAO)
    requisicao.onupgradeneeded = () => {
      const db = requisicao.result
      if (!db.objectStoreNames.contains('formularios')) db.createObjectStore('formularios', { keyPath: 'xmlFormId' })
      if (!db.objectStoreNames.contains('pacotes')) db.createObjectStore('pacotes', { keyPath: 'xmlFormId' })
      if (!db.objectStoreNames.contains('rascunhos')) db.createObjectStore('rascunhos', { keyPath: 'localId' })
      if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'localId' })
    }
    requisicao.onsuccess = () => resolve(requisicao.result)
    requisicao.onerror = () => reject(requisicao.error)
  })

  return {
    async listarFormularios(): Promise<Formulario[]> {
      const db = await pronto
      return pedir(db.transaction('formularios').objectStore('formularios').getAll())
    },

    async salvarFormularios(formularios: Formulario[]): Promise<void> {
      const db = await pronto
      await transacao(db, ['formularios'], 'readwrite', (tx) => {
        const loja = tx.objectStore('formularios')
        for (const f of formularios) loja.put(f)
      })
    },

    async salvarPacote(pacote: Pacote): Promise<void> {
      const db = await pronto
      await transacao(db, ['pacotes'], 'readwrite', (tx) => {
        tx.objectStore('pacotes').put(pacote)
      })
    },

    async lerPacote(xmlFormId: string): Promise<Pacote | undefined> {
      const db = await pronto
      return pedir(db.transaction('pacotes').objectStore('pacotes').get(xmlFormId))
    },

    async salvarRascunho(rascunho: Rascunho): Promise<void> {
      const db = await pronto
      await transacao(db, ['rascunhos'], 'readwrite', (tx) => {
        tx.objectStore('rascunhos').put(rascunho)
      })
    },

    async listarRascunhos(): Promise<Rascunho[]> {
      const db = await pronto
      return pedir(db.transaction('rascunhos').objectStore('rascunhos').getAll())
    },

    async lerRascunho(localId: string): Promise<Rascunho | undefined> {
      const db = await pronto
      return pedir(db.transaction('rascunhos').objectStore('rascunhos').get(localId))
    },

    async apagarRascunho(localId: string): Promise<void> {
      const db = await pronto
      await transacao(db, ['rascunhos'], 'readwrite', (tx) => {
        tx.objectStore('rascunhos').delete(localId)
      })
    },

    async enfileirar(item: ItemFila): Promise<void> {
      const db = await pronto
      await transacao(db, ['rascunhos', 'fila'], 'readwrite', (tx) => {
        tx.objectStore('fila').put(item)
        tx.objectStore('rascunhos').delete(item.localId)
      })
    },

    async listarFila(): Promise<ItemFila[]> {
      const db = await pronto
      return pedir(db.transaction('fila').objectStore('fila').getAll())
    },

    async atualizarItem(item: ItemFila): Promise<void> {
      const db = await pronto
      await transacao(db, ['fila'], 'readwrite', (tx) => {
        tx.objectStore('fila').put(item)
      })
    },
  }
}

/** Marcador mínimo de bootstrap: só o workspace ativo, nunca credencial. */
export function workspaceAtivo(): string | null {
  return localStorage.getItem('modk.workspace')
}

export function definirWorkspace(id: string | null): void {
  if (id) localStorage.setItem('modk.workspace', id)
  else localStorage.removeItem('modk.workspace')
}

export async function pedirPersistencia(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}
