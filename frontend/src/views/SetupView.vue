<script setup lang="ts">
import { ref } from 'vue'
import QrScanner from '../components/QrScanner.vue'
import BotaoPilula from '../components/BotaoPilula.vue'
import { VERSAO } from '../versao'

const props = defineProps<{ conectando: boolean; erro: string | null }>()
const emit = defineEmits<{ (e: 'conectar', qr: string): void }>()

const qr = ref('')
const escaneando = ref(false)
const colando = ref(false)

function recebido(valor: string) {
  escaneando.value = false
  qr.value = valor
  colando.value = false
  emit('conectar', valor)
}
</script>

<template>
  <section class="inicio">
    <div class="hero">
      <img
        src="/branding/simbolo-envelhecer.png"
        alt=""
        width="120"
        height="120"
        class="logo"
      />
      <h1 class="titulo">Coleta de campo<br />em qualquer lugar</h1>
      <p class="texto-secundario subtitulo">
        Funciona sem sinal. Envia ao ODK Central quando houver conexão.
      </p>
    </div>

    <div class="acoes">
      <BotaoPilula variante="primario" icone="qr" :desabilitado="props.conectando" @click="escaneando = true">
        {{ props.conectando ? 'Conectando…' : 'Configurar com QR code' }}
      </BotaoPilula>

      <BotaoPilula icone="lapis" @click="colando = !colando">
        Colar o conteúdo do QR
      </BotaoPilula>
    </div>

    <div v-if="colando" class="colar">
      <textarea v-model="qr" rows="5" aria-label="conteúdo do QR" placeholder="cole aqui o conteúdo do QR"></textarea>
      <BotaoPilula
        variante="primario"
        :desabilitado="!qr.trim() || props.conectando"
        @click="emit('conectar', qr.trim())"
      >
        Conectar
      </BotaoPilula>
    </div>

    <p v-if="props.erro" class="erro aviso" role="alert">{{ props.erro }}</p>

    <footer class="rodape">
      <div class="instituicoes">
        <img src="/branding/ifrj.png" alt="Instituto Federal do Rio de Janeiro" />
        <img src="/branding/ifmg.png" alt="Instituto Federal de Minas Gerais" />
      </div>
      <p class="versao texto-secundario">My ODK Client {{ VERSAO }}</p>
    </footer>

    <QrScanner v-if="escaneando" @ler="recebido" @fechar="escaneando = false" />
  </section>
</template>

<style scoped>
.inicio {
  min-height: 100vh;
  min-height: 100dvh;
  max-width: 640px;
  margin: 0 auto;
  padding: calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  text-align: center;
}
.hero {
  margin-top: 8vh;
  display: grid;
  justify-items: center;
  gap: 18px;
}
.logo {
  width: 120px;
  height: 120px;
  object-fit: contain;
}
.titulo {
  font-size: 2rem;
  line-height: 1.2;
  font-weight: 300;
}
.subtitulo {
  margin: 0;
  font-size: 0.95rem;
  max-width: 28ch;
}
.acoes {
  margin-top: 32px;
  display: grid;
  gap: 12px;
}
.acoes :deep(.pilula),
.colar :deep(.pilula) {
  justify-content: center;
}
.acoes :deep(.rotulo),
.colar :deep(.rotulo) {
  flex: 0 1 auto;
}
.colar {
  margin-top: 16px;
  display: grid;
  gap: 12px;
}
textarea {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--divisor);
  background: var(--superficie);
  color: var(--texto);
  font-family: ui-monospace, monospace;
  font-size: 0.8rem;
  text-align: left;
}
.aviso { margin-top: 16px; }
.rodape {
  margin-top: auto;
  padding-top: 32px;
  display: grid;
  justify-items: center;
  gap: 10px;
}
.instituicoes {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}
.instituicoes img {
  height: 56px;
  width: auto;
}
@media (prefers-color-scheme: dark) {
  .instituicoes {
    background: #ffffff;
    border-radius: 12px;
    padding: 10px 14px;
  }
}
.versao {
  margin: 0;
  font-size: 0.8rem;
}
</style>
