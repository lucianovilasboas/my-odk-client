<script setup lang="ts">
import { ref } from 'vue'
import QrScanner from '../components/QrScanner.vue'

const props = defineProps<{ conectando: boolean; erro: string | null }>()
const emit = defineEmits<{ (e: 'conectar', qr: string): void }>()

const qr = ref('')
const escaneando = ref(false)

function recebido(valor: string) {
  escaneando.value = false
  qr.value = valor
  emit('conectar', valor)
}
</script>

<template>
  <section class="setup">
    <h2>Configurar este aparelho</h2>
    <p class="explicacao">
      Este aparelho passa a pertencer a um único agente. Escaneie o QR do seu App
      User no ODK Central — o projeto e o formulário vêm junto, sem precisar
      digitar nenhum código.
    </p>

    <button class="primario escanear" :disabled="props.conectando" @click="escaneando = true">
      <span aria-hidden="true">▣</span> Escanear QR code
    </button>

    <details class="alternativa">
      <summary>Prefiro colar o conteúdo</summary>
      <textarea
        v-model="qr"
        rows="5"
        aria-label="conteúdo do QR"
        placeholder="cole aqui o conteúdo do QR"
      ></textarea>
      <button :disabled="!qr.trim() || props.conectando" @click="emit('conectar', qr.trim())">
        {{ props.conectando ? 'Conectando…' : 'Conectar' }}
      </button>
    </details>

    <p v-if="props.erro" class="erro" role="alert">{{ props.erro }}</p>

    <QrScanner v-if="escaneando" @ler="recebido" @fechar="escaneando = false" />
  </section>
</template>

<style scoped>
.setup { display: grid; gap: 16px; }
.explicacao { color: #3d4d4a; line-height: 1.5; }
.escanear { min-height: 56px; font-size: 1.05rem; display: flex; align-items: center; justify-content: center; gap: 10px; }
.alternativa { display: grid; gap: 8px; }
summary { cursor: pointer; color: #4a5b58; padding: 8px 0; }
textarea { width: 100%; font-family: ui-monospace, monospace; font-size: 0.8rem; padding: 8px; }
.erro { color: #a3231a; }
</style>
