/** Cliente da API do adaptador. Nunca vê o token: só o workspaceId. */

export interface Sessao {
  workspaceId: string
  scope: { host: string; projectId: string }
  expiresAt?: number
}

export interface Formulario {
  xmlFormId: string
  name: string
  version: string
  hash: string
}

export interface Pacote {
  xmlFormId: string
  xml: string
  resources: { filename: string; hash: string; url: string }[]
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryable = false,
  ) {
    super(message)
  }
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, { credentials: 'same-origin', ...init })
  if (resposta.status === 204) return undefined as T

  const tipo = resposta.headers.get('content-type') ?? ''
  const corpo = tipo.includes('application/json') ? await resposta.json() : await resposta.text()

  if (!resposta.ok) {
    const dados = typeof corpo === 'object' && corpo ? corpo : { code: 'UNKNOWN', message: String(corpo) }
    throw new ApiError(dados.code ?? 'UNKNOWN', dados.message ?? 'falha', resposta.status, Boolean(dados.retryable))
  }
  return corpo as T
}

export const api = {
  sessao: () => pedir<Sessao>('/api/v1/session'),

  conectar: (qr: string) =>
    pedir<Sessao>('/api/v1/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr }),
    }),

  sair: () => pedir<void>('/api/v1/session', { method: 'DELETE' }),

  formularios: () => pedir<{ forms: Formulario[] }>('/api/v1/forms'),

  pacote: (xmlFormId: string) => pedir<Pacote>(`/api/v1/forms/${encodeURIComponent(xmlFormId)}/package`),

  recurso: async (url: string) => {
    const resposta = await fetch(url, { credentials: 'same-origin' })
    if (!resposta.ok) throw new ApiError('RESOURCE_MISSING', 'recurso indisponível', resposta.status)
    return new Uint8Array(await resposta.arrayBuffer())
  },

  enviar: async (xml: string) => {
    const dados = new FormData()
    dados.append('xml_submission_file', new Blob([xml], { type: 'text/xml' }), 'submission.xml')
    return pedir<{ status: string }>('/api/v1/submissions', { method: 'POST', body: dados })
  },
}
