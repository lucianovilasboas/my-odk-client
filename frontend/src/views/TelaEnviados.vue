<script setup lang="ts">
import type { ItemFila } from '../storage'

defineProps<{ itens: ItemFila[]; nomeDoFormulario: (id: string) => string }>()

const quando = (ms: number) => new Date(ms).toLocaleString('pt-BR')
</script>

<template>
  <section class="tela">
    <p v-if="!itens.length" class="texto-secundario">Nenhum formulário enviado ainda.</p>

    <div class="pilha">
      <article v-for="i in itens" :key="i.localId" class="cartao">
        <strong>{{ nomeDoFormulario(i.xmlFormId) }}</strong>
        <p class="texto-secundario meta">
          confirmado pelo servidor · {{ quando(i.atualizadoEm) }}
        </p>
      </article>
    </div>

    <p class="texto-secundario nota">
      Os envios confirmados ficam neste aparelho até que a política de retenção seja definida.
    </p>
  </section>
</template>

<style scoped>
.cartao {
  background: var(--cartao);
  border-radius: var(--raio-cartao);
  padding: 18px;
  display: grid;
  gap: 6px;
  box-shadow: var(--sombra);
}
.meta { margin: 0; font-size: 0.85rem; }
.nota { margin-top: 20px; font-size: 0.8rem; }
</style>
