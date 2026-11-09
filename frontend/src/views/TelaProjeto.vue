<script setup lang="ts">
import BotaoPilula from '../components/BotaoPilula.vue'

defineProps<{
  rascunhos: number
  pendentes: number
  enviados: number
}>()

defineEmits<{
  (e: 'preencher'): void
  (e: 'rascunhos'): void
  (e: 'fila'): void
  (e: 'enviados'): void
  (e: 'reconfigurar'): void
}>()
</script>

<template>
  <section class="tela">
    <div class="pilha">
      <BotaoPilula variante="primario" icone="mais" @click="$emit('preencher')">
        Preencher novo formulário
      </BotaoPilula>

      <BotaoPilula icone="lapis" :contagem="rascunhos || null" @click="$emit('rascunhos')">
        Rascunhos
      </BotaoPilula>

      <BotaoPilula icone="enviar" :contagem="pendentes || null" @click="$emit('fila')">
        Pronto para enviar
      </BotaoPilula>

      <BotaoPilula icone="check" :contagem="enviados || null" @click="$emit('enviados')">
        Enviado
      </BotaoPilula>

      <BotaoPilula class="espaco-topo" variante="perigo" icone="engrenagem" @click="$emit('reconfigurar')">
        Reconfigurar aparelho
      </BotaoPilula>
    </div>
  </section>
</template>

<style scoped>
.espaco-topo {
  margin-top: 24px;
}
</style>
