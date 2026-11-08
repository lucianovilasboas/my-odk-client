<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import jsQR from 'jsqr'

/**
 * Leitor de QR em tela cheia.
 *
 * Usa `BarcodeDetector` quando o navegador oferece; caso contrário decodifica os
 * frames com `jsQR`. Se a câmera for negada, avisa e devolve o controle para a
 * tela de configuração, que aceita colar o conteúdo.
 */

const emit = defineEmits<{ (e: 'ler', valor: string): void; (e: 'fechar'): void }>()

const video = ref<HTMLVideoElement | null>(null)
const erro = ref<string | null>(null)
const lendo = ref(true)

let stream: MediaStream | null = null
let parado = false

function encerrarCamera() {
  parado = true
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

function fechar() {
  encerrarCamera()
  emit('fechar')
}

onMounted(async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
    if (!video.value) return
    video.value.srcObject = stream
    await video.value.play()
    void laco()
  } catch {
    erro.value =
      'Não foi possível abrir a câmera. Verifique a permissão ou use o campo para colar o conteúdo do QR.'
    lendo.value = false
  }
})

onBeforeUnmount(encerrarCamera)

async function laco() {
  if (parado) return

  const elemento = video.value
  if (elemento && elemento.readyState === 4 && elemento.videoWidth) {
    const texto = await decodificar(elemento)
    if (texto) {
      lendo.value = false
      encerrarCamera()
      emit('ler', texto)
      return
    }
  }

  setTimeout(laco, 150)
}

async function decodificar(elemento: HTMLVideoElement): Promise<string | null> {
  const Detector = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector

  if (Detector) {
    try {
      const detector = new Detector({ formats: ['qr_code'] })
      const codigos = await detector.detect(elemento)
      const valor = codigos?.[0]?.rawValue
      if (valor) return valor
    } catch {
      // segue para o fallback
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = elemento.videoWidth
  canvas.height = elemento.videoHeight
  const contexto = canvas.getContext('2d', { willReadFrequently: true })
  if (!contexto) return null

  contexto.drawImage(elemento, 0, 0, canvas.width, canvas.height)
  const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(imagem.data, imagem.width, imagem.height)?.data ?? null
}
</script>

<template>
  <div class="scanner" role="dialog" aria-modal="true" aria-label="Leitor de QR code">
    <div class="mira">
      <video ref="video" playsinline muted></video>
      <div class="moldura" aria-hidden="true"></div>
    </div>

    <p class="instrucao">Aponte para o QR code do App User</p>
    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>

    <button class="fechar" @click="fechar">Cancelar</button>
    <p v-if="lendo" class="status" aria-live="polite">Procurando código…</p>
  </div>
</template>

<style scoped>
.scanner {
  position: fixed;
  inset: 0;
  background: #071b1a;
  display: grid;
  grid-template-rows: 1fr auto auto;
  gap: 12px;
  padding: 16px calc(16px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom))
    calc(16px + env(safe-area-inset-left));
  color: #fff;
  z-index: 50;
}
.mira {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 16px;
}
video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.moldura {
  position: absolute;
  width: min(68vw, 320px);
  aspect-ratio: 1;
  border: 3px solid #f2a33c;
  border-radius: 16px;
  box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.45);
}
.instrucao {
  text-align: center;
  margin: 0;
}
.status {
  text-align: center;
  margin: 0;
  opacity: 0.75;
  font-size: 0.85rem;
}
.erro {
  text-align: center;
  color: #ffb4a8;
  margin: 0;
}
.fechar {
  min-height: 48px;
  border-radius: 10px;
  border: 1px solid #3a5a58;
  background: transparent;
  color: #fff;
  font-size: 1rem;
}
</style>
