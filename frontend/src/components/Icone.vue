<script setup lang="ts">
/** Ícones em traço, herdando a cor do texto. Sem dependência de fonte. */
defineProps<{
  nome: 'mais' | 'lapis' | 'enviar' | 'check' | 'engrenagem' | 'qr' | 'voltar' | 'lixeira' | 'alerta'
  tamanho?: number
}>()
</script>

<template>
  <svg
    :width="tamanho ?? 22"
    :height="tamanho ?? 22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <template v-if="nome === 'mais'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="nome === 'lapis'">
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    </template>
    <template v-else-if="nome === 'enviar'">
      <path d="M4 12l16-8-6 16-2-6-8-2z" />
    </template>
    <template v-else-if="nome === 'check'">
      <path d="M5 13l4 4L19 7" />
    </template>
    <template v-else-if="nome === 'engrenagem'">
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2.2" />
      <circle cx="15" cy="12" r="2.2" />
      <circle cx="7" cy="17" r="2.2" />
    </template>
    <template v-else-if="nome === 'qr'">
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />
    </template>
    <template v-else-if="nome === 'voltar'">
      <path d="M15 5l-7 7 7 7" />
    </template>
    <template v-else-if="nome === 'lixeira'">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </template>
    <template v-else-if="nome === 'alerta'">
      <path d="M12 8v5M12 16.5v.5" />
      <circle cx="12" cy="12" r="9" />
    </template>
  </svg>
</template>

<style scoped>
svg {
  flex: 0 0 auto;
  display: block;
}
</style>
