<script setup lang="ts">
import BotaoPilula from '../components/BotaoPilula.vue'
import type { Rascunho } from '../storage'

defineProps<{ rascunhos: Rascunho[]; nomeDoFormulario: (id: string) => string }>()
defineEmits<{ (e: 'continuar', r: Rascunho): void; (e: 'descartar', r: Rascunho): void }>()

const quando = (ms: number) => new Date(ms).toLocaleString('pt-BR')
</script>

<template>
  <section class="tela">
    <p v-if="!rascunhos.length" class="texto-secundario">Nenhum rascunho salvo neste aparelho.</p>

    <div class="pilha">
      <article v-for="r in rascunhos" :key="r.localId" class="cartao">
        <strong>{{ nomeDoFormulario(r.xmlFormId) }}</strong>
        <p class="texto-secundario meta">salvo em {{ quando(r.atualizadoEm) }}</p>
        <div class="acoes">
          <BotaoPilula variante="primario" icone="lapis" @click="$emit('continuar', r)">
            Continuar
          </BotaoPilula>
          <BotaoPilula variante="perigo" icone="lixeira" @click="$emit('descartar', r)">
            Descartar
          </BotaoPilula>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.cartao {
  background: var(--cartao);
  border-radius: var(--raio-cartao);
  padding: 18px;
  display: grid;
  gap: 10px;
  box-shadow: var(--sombra);
}
.meta { margin: 0; font-size: 0.85rem; }
.acoes { display: grid; gap: 10px; }
</style>
