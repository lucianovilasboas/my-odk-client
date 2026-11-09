<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'

/**
 * Seleção com busca, para listas longas (agentes, pessoas idosas, municípios).
 *
 * Filtra ignorando acento e caixa. Funciona por teclado: ↑↓ navegam, Enter
 * escolhe, Esc fecha. Comunica estado via ARIA (`role="combobox"`).
 */

const props = defineProps<{ no: any; versao: number; rotulo: string; obrigatorio?: boolean }>()
const emit = defineEmits<{ (e: 'alterou', imediato: boolean): void }>()

const MAX_VISIVEIS = 50

const campo = ref<HTMLInputElement | null>(null)
const busca = ref('')
const aberto = ref(false)
const destaque = ref(0)

const opcoes = computed<{ value: string; label: string }[]>(() => {
  void props.versao
  return (props.no?.currentState?.valueOptions ?? []).map((i: any) => ({
    value: i.value,
    label: i.label.asString,
  }))
})

const selecionado = computed(() => {
  void props.versao
  const valor = props.no?.currentState?.value
  const atual = Array.isArray(valor) ? valor[0] : valor
  return opcoes.value.find((o) => o.value === atual) ?? null
})

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const filtradas = computed(() => {
  const termo = semAcento(busca.value.trim())
  if (!termo) return opcoes.value
  return opcoes.value.filter(
    (o) => semAcento(o.label).includes(termo) || semAcento(o.value).includes(termo),
  )
})

const visiveis = computed(() => filtradas.value.slice(0, MAX_VISIVEIS))
const truncado = computed(() => filtradas.value.length > MAX_VISIVEIS)

function abrir() {
  aberto.value = true
  busca.value = ''
  destaque.value = Math.max(
    0,
    visiveis.value.findIndex((o) => o.value === selecionado.value?.value),
  )
}

function fechar() {
  aberto.value = false
  busca.value = ''
}

function escolher(opcao: { value: string; label: string }) {
  props.no.selectValue(opcao.value)
  fechar()
  campo.value?.blur()
  emit('alterou', true)
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'ArrowDown') {
    evento.preventDefault()
    destaque.value = Math.min(destaque.value + 1, visiveis.value.length - 1)
    return
  }
  if (evento.key === 'ArrowUp') {
    evento.preventDefault()
    destaque.value = Math.max(0, destaque.value - 1)
    return
  }
  if (evento.key === 'Escape') {
    evento.preventDefault()
    fechar()
    return
  }
  if (evento.key === 'Enter') {
    // Enter aqui escolhe; não pode vazar para o "avançar" da tela.
    evento.preventDefault()
    evento.stopPropagation()
    const alvo = visiveis.value[destaque.value]
    if (alvo) escolher(alvo)
  }
}

function aoDigitar(evento: Event) {
  busca.value = (evento.target as HTMLInputElement).value
  aberto.value = true
  destaque.value = 0
}

onMounted(() => {
  nextTick(() => {
    if (props.no?.currentState?.value) busca.value = selecionado.value?.label ?? ''
  })
})

const textoExibido = computed(() => (aberto.value ? busca.value : (selecionado.value?.label ?? '')))
</script>

<template>
  <div class="busca">
    <label :for="`busca-${no.nodeId}`">
      {{ rotulo }}<span v-if="obrigatorio" class="obrigatorio" aria-hidden="true"> *</span>
    </label>

    <input
      :id="`busca-${no.nodeId}`"
      ref="campo"
      type="text"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="aberto"
      :aria-controls="`lista-${no.nodeId}`"
      autocomplete="off"
      enterkeyhint="done"
      :placeholder="selecionado ? '' : 'Digite para buscar…'"
      :value="textoExibido"
      @focus="abrir"
      @input="aoDigitar"
      @keydown="aoTeclar"
      @blur="fechar"
    />

    <ul v-if="aberto" :id="`lista-${no.nodeId}`" class="lista" role="listbox">
      <li
        v-for="(opcao, i) in visiveis"
        :key="opcao.value"
        role="option"
        :aria-selected="opcao.value === selecionado?.value"
        :class="{ destaque: i === destaque }"
        @mousedown.prevent="escolher(opcao)"
      >
        {{ opcao.label }}
      </li>
      <li v-if="!visiveis.length" class="vazio">Nenhuma opção encontrada</li>
      <li v-if="truncado" class="vazio">
        Mostrando {{ MAX_VISIVEIS }} de {{ filtradas.length }} — refine a busca
      </li>
    </ul>
  </div>
</template>

<style scoped>
.busca { display: grid; gap: 6px; margin: 14px 0; position: relative; }
label { font-weight: 500; }
input {
  min-height: 44px;
  border: 1px solid #c9cfce;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 1rem;
  width: 100%;
  background: #fff;
}
.lista {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 46vh;
  overflow-y: auto;
  border: 1px solid #c9cfce;
  border-radius: 8px;
  background: #fff;
}
.lista li { padding: 12px; min-height: 44px; border-bottom: 1px solid #eef1f0; }
.lista li:last-child { border-bottom: 0; }
.lista li.destaque { background: #e6efee; }
.lista li.vazio { color: #4a5b58; font-size: 0.85rem; }
.obrigatorio { color: #a3231a; }
</style>
