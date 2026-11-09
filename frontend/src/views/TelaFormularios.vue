<script setup lang="ts">
import BotaoPilula from '../components/BotaoPilula.vue'
import type { Formulario } from '../api'

defineProps<{ formularios: Formulario[]; disponiveis: Set<string> }>()
defineEmits<{ (e: 'preencher', xmlFormId: string): void }>()
</script>

<template>
  <section class="tela">
    <p v-if="!formularios.length" class="texto-secundario">
      Nenhum formulário disponível. Toque em Atualizar quando tiver conexão.
    </p>

    <div class="pilha">
      <article v-for="f in formularios" :key="f.xmlFormId" class="cartao">
        <strong>{{ f.name }}</strong>
        <p class="texto-secundario meta">
          versão {{ f.version || '—' }}
          <span v-if="disponiveis.has(f.xmlFormId)" class="sucesso">· no aparelho</span>
          <span v-else class="erro">· não baixado</span>
        </p>
        <BotaoPilula
          variante="primario"
          icone="mais"
          :desabilitado="!disponiveis.has(f.xmlFormId)"
          @click="$emit('preencher', f.xmlFormId)"
        >
          Preencher
        </BotaoPilula>
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
.meta {
  margin: 0;
  font-size: 0.85rem;
}
</style>
