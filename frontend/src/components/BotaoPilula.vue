<script setup lang="ts">
import Icone from './Icone.vue'

/** Pílula grande, como no Collect: ícone à esquerda, rótulo, contador à direita. */
withDefaults(
  defineProps<{
    variante?: 'primario' | 'secundario' | 'perigo'
    icone?: 'mais' | 'lapis' | 'enviar' | 'check' | 'engrenagem' | 'qr' | 'voltar' | 'lixeira' | 'alerta'
    contagem?: number | null
    desabilitado?: boolean
    tipo?: 'button' | 'submit'
  }>(),
  { variante: 'secundario', contagem: null, desabilitado: false, tipo: 'button' },
)
</script>

<template>
  <button
    :type="tipo"
    class="pilula"
    :class="variante"
    :disabled="desabilitado"
  >
    <Icone v-if="icone" :nome="icone" :tamanho="24" />
    <span class="rotulo"><slot /></span>
    <span v-if="contagem" class="contagem">{{ contagem }}</span>
  </button>
</template>

<style scoped>
.pilula {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  min-height: var(--altura-pilula);
  padding: 0 24px;
  border: 0;
  border-radius: var(--raio-pilula);
  font-size: 1.1rem;
  font-weight: 400;
  text-align: left;
  transition: filter 0.15s ease;
}

.pilula:active:not(:disabled) {
  filter: brightness(0.94);
}

.primario {
  background: var(--acento);
  color: var(--texto-acento);
}

.secundario {
  background: var(--superficie);
  color: var(--texto);
  box-shadow: var(--sombra);
}

.perigo {
  background: transparent;
  color: var(--erro);
  box-shadow: inset 0 0 0 1px var(--divisor);
}

.rotulo {
  flex: 1;
}

.contagem {
  font-variant-numeric: tabular-nums;
  font-size: 0.95rem;
  opacity: 0.75;
}
</style>
