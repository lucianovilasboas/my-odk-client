/**
 * Orquestração do envio em primeiro plano.
 *
 * Não existe envio com o app fechado (iOS não oferece Background Sync e o
 * agendamento do Android não é confiável). Os gatilhos são: rede de volta, app
 * voltando ao primeiro plano, abertura do app e retry com backoff.
 */
import { servidorAlcancavel } from './alcance'

export type EstadoEnvio = 'ocioso' | 'verificando' | 'enviando'

export interface ResultadoLote {
  confirmados: number
  falhas: number
  /** Erro definitivo (401, 409, 422): insistir não resolve. */
  parar: boolean
}

export interface OpcoesAutoEnvio {
  temPendencias: () => boolean
  enviarLote: () => Promise<ResultadoLote>
  aoMudarEstado?: (estado: EstadoEnvio) => void
  aoConcluir?: (resultado: ResultadoLote) => void
}

export interface ControladorEnvio {
  parar: () => void
  /** Usado pelo botão "Enviar agora". */
  enviarAgora: () => Promise<void>
}

const ESPERAS_SEGUNDOS = [30, 60, 120, 240, 300]
const NOME_TRAVA = 'modk-envio'

export function iniciarAutoEnvio(opcoes: OpcoesAutoEnvio): ControladorEnvio {
  let emAndamento = false
  let indiceBackoff = 0
  let temporizador: ReturnType<typeof setTimeout> | null = null
  let parado = false

  function limparTimer() {
    if (temporizador) {
      clearTimeout(temporizador)
      temporizador = null
    }
  }

  function agendar() {
    if (parado) return
    limparTimer()

    const base = ESPERAS_SEGUNDOS[Math.min(indiceBackoff, ESPERAS_SEGUNDOS.length - 1)]
    indiceBackoff += 1
    const jitter = 0.8 + Math.random() * 0.4
    const espera = Math.round(base * jitter) * 1000

    temporizador = setTimeout(() => {
      temporizador = null
      void tentar()
    }, espera)
  }

  /** Duas abas não podem enviar a mesma fila ao mesmo tempo. */
  async function comTrava<T>(trabalho: () => Promise<T>): Promise<T | null> {
    const travas = (navigator as unknown as { locks?: LockManager }).locks

    if (!travas) {
      if (emAndamento) return null
      emAndamento = true
      try {
        return await trabalho()
      } finally {
        emAndamento = false
      }
    }

    return travas.request(NOME_TRAVA, { ifAvailable: true }, async (trava) => {
      if (!trava) return null
      return trabalho()
    })
  }

  async function tentar(): Promise<void> {
    if (parado || !opcoes.temPendencias()) return
    if (!navigator.onLine) return

    opcoes.aoMudarEstado?.('verificando')
    const alcancavel = await servidorAlcancavel()
    if (!alcancavel) {
      opcoes.aoMudarEstado?.('ocioso')
      agendar()
      return
    }

    opcoes.aoMudarEstado?.('enviando')
    let resultado: ResultadoLote | null = null
    try {
      resultado = await comTrava(opcoes.enviarLote)
    } finally {
      opcoes.aoMudarEstado?.('ocioso')
    }

    if (!resultado) {
      // outra aba está enviando
      agendar()
      return
    }

    opcoes.aoConcluir?.(resultado)

    if (resultado.parar) {
      indiceBackoff = 0
      limparTimer()
      return
    }
    if (resultado.falhas > 0) {
      agendar()
    } else {
      indiceBackoff = 0
      limparTimer()
    }
  }

  const aoVoltarRede = () => {
    indiceBackoff = 0
    void tentar()
  }

  const aoMudarVisibilidade = () => {
    if (document.visibilityState === 'visible') {
      indiceBackoff = 0
      void tentar()
    }
  }

  window.addEventListener('online', aoVoltarRede)
  document.addEventListener('visibilitychange', aoMudarVisibilidade)

  void tentar()

  return {
    parar() {
      parado = true
      limparTimer()
      window.removeEventListener('online', aoVoltarRede)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    },
    async enviarAgora() {
      indiceBackoff = 0
      await tentar()
    },
  }
}
