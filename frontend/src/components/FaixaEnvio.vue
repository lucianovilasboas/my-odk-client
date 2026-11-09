<script setup lang="ts">
/** Faixa discreta de progresso; não bloqueia a coleta. */
defineProps<{ estado: 'verificando' | 'enviando'; atual: number; total: number }>()
</script>

<template>
  <div class="faixa" role="status" aria-live="polite">
    <span class="ponto" aria-hidden="true"></span>
    <span v-if="estado === 'verificando'">Verificando conexão…</span>
    <span v-else>Enviando {{ atual }} de {{ total }}…</span>
  </div>
</template>

<style scoped>
.faixa {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 auto;
  padding: 10px 16px;
  max-width: 640px;
  color: var(--texto-2);
  font-size: 0.85rem;
}
.ponto {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--acento);
  animation: pulsar 1.2s ease-in-out infinite;
}
@keyframes pulsar {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .ponto { animation: none; }
}
</style>
