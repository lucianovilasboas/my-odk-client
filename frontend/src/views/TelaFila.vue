<script setup lang="ts">
import BotaoPilula from '../components/BotaoPilula.vue'
import type { ItemFila } from '../storage'

defineProps<{
  itens: ItemFila[]
  enviando: boolean
  podeEnviar: boolean
  nomeDoFormulario: (id: string) => string
}>()
defineEmits<{ (e: 'enviar'): void }>()

const quando = (ms: number) => new Date(ms).toLocaleString('pt-BR')
</script>

<template>
  <section class="tela">
    <p v-if="!itens.length" class="texto-secundario">
      Nada aguardando envio. Tudo o que foi finalizado já chegou ao servidor.
    </p>

    <div class="pilha">
      <article v-for="i in itens" :key="i.localId" class="cartao">
        <strong>{{ nomeDoFormulario(i.xmlFormId) }}</strong>
        <p class="texto-secundario meta">
          {{ i.estado === 'erro' ? 'falhou' : 'aguardando conexão' }} · tentativas {{ i.tentativas }} ·
          {{ quando(i.atualizadoEm) }}
        </p>
        <p v-if="i.ultimoErro" class="erro meta">{{ i.ultimoErro }}</p>
      </article>
    </div>

    <div v-if="itens.length" class="acoes">
      <BotaoPilula
        variante="primario"
        icone="enviar"
        :desabilitado="enviando || !podeEnviar"
        @click="$emit('enviar')"
      >
        {{ !podeEnviar ? 'Sem conexão' : enviando ? 'Enviando…' : `Enviar ${itens.length} agora` }}
      </BotaoPilula>
      <p v-if="!podeEnviar" class="texto-secundario dica">
        O envio automático acontece assim que o aplicativo alcançar o servidor.
      </p>
    </div>
  </section>
</template>

<style scoped>
.cartao {
  background: var(--cartao);
  border-radius: var(--raio-cartao);
  padding: 18px;
  display: grid;
  gap: 8px;
  box-shadow: var(--sombra);
}
.meta { margin: 0; font-size: 0.85rem; }
.acoes { margin-top: 20px; display: grid; gap: 10px; }
.dica { margin: 0; font-size: 0.8rem; }
</style>
