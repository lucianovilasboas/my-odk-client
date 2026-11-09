<script setup lang="ts">
import type { ItemFila, RegistroEnvio } from '../storage'

defineProps<{
  itens: ItemFila[]
  tentativas: RegistroEnvio[]
  nomeDoFormulario: (id: string) => string
}>()

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

    <h2 v-if="tentativas.length" class="titulo-secao">Últimas tentativas</h2>
    <ul v-if="tentativas.length" class="registros">
      <li v-for="t in tentativas" :key="t.id" :class="t.resultado">
        <span class="quando">{{ quando(t.em) }}</span>
        <span class="form">{{ nomeDoFormulario(t.xmlFormId) }}</span>
        <span class="resultado">
          {{ t.resultado === 'confirmado' ? 'enviado' : (t.codigo ?? 'falhou') }}
        </span>
      </li>
    </ul>

    <p class="texto-secundario nota">
      Os envios confirmados ficam neste aparelho até que a política de retenção seja definida.
      O diário guarda 90 dias ou 500 registros e não contém respostas.
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
.titulo-secao { font-size: 1rem; margin: 28px 0 10px; }
.registros {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
  font-size: 0.8rem;
}
.registros li {
  display: grid;
  grid-template-columns: 8.5rem 1fr auto;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--divisor);
  color: var(--texto-2);
}
.registros li.confirmado .resultado { color: var(--sucesso); }
.registros li.falha .resultado { color: var(--erro); }
.quando { font-variant-numeric: tabular-nums; }
.form { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nota { margin-top: 20px; font-size: 0.8rem; }
</style>
