/**
 * Sinais sonoros do leitor de QR.
 *
 * Sintetizados com Web Audio API — sem arquivo, sem dependência. O contexto é
 * criado sob demanda e retomado se o sistema o tiver suspendido (comum no
 * Android depois de o app ir para segundo plano).
 */

type TipoOnda = OscillatorType

let contexto: AudioContext | null = null

function obterContexto(): AudioContext | null {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null

  if (!contexto) contexto = new Ctor()
  if (contexto.state === 'suspended') void contexto.resume()
  return contexto
}

function tom(
  frequencia: number,
  duracao: number,
  { tipo = 'sine' as TipoOnda, atraso = 0, volume = 0.16 } = {},
) {
  const audio = obterContexto()
  if (!audio) return

  const inicio = audio.currentTime + atraso
  const oscilador = audio.createOscillator()
  const ganho = audio.createGain()

  oscilador.type = tipo
  oscilador.frequency.setValueAtTime(frequencia, inicio)

  // Envelope curto para evitar estalo no começo e no fim.
  ganho.gain.setValueAtTime(0, inicio)
  ganho.gain.linearRampToValueAtTime(volume, inicio + 0.01)
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao)

  oscilador.connect(ganho).connect(audio.destination)
  oscilador.start(inicio)
  oscilador.stop(inicio + duracao + 0.02)
}

/** Código lido: bipe curto e agudo, como leitor de código de barras. */
export function somLeitura() {
  tom(880, 0.09)
  vibrar(25)
}

/** Credencial aceita e sessão criada. */
export function somSucesso() {
  tom(740, 0.11)
  tom(1100, 0.16, { atraso: 0.13 })
  vibrar(60)
}

/** Falha ao ler ou ao conectar. */
export function somErro() {
  tom(220, 0.22, { tipo: 'square', volume: 0.12 })
  tom(180, 0.2, { tipo: 'square', atraso: 0.16, volume: 0.1 })
  vibrar([80, 60, 80])
}

function vibrar(padrao: number | number[]) {
  try {
    navigator.vibrate?.(padrao)
  } catch {
    // aparelho sem vibração
  }
}

/** Aquece o áudio no gesto do usuário, para o bipe não ser bloqueado. */
export function prepararAudio() {
  obterContexto()
}
