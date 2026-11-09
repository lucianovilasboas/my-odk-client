<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * Renderizador mínimo do corpus: grupos, notas, texto, inteiro, geopoint e
 * seleção simples/múltipla.
 *
 * O campo de texto é **não controlado**: o valor do motor nunca é reescrito
 * enquanto o campo está em foco. Reescrever no meio da digitação fecha o
 * teclado no Android e perde a composição do IME.
 */

const props = defineProps<{ no: any; versao: number }>()
const emit = defineEmits<{ (e: 'alterou', imediato: boolean): void }>()

const tipo = computed(() => props.no?.nodeType as string)
const estado = computed(() => {
  void props.versao
  return props.no?.currentState
})
const rotulo = computed(() => estado.value?.label?.asString ?? '')
const visivel = computed(() => {
  void props.versao
  return props.no?.currentState?.relevant !== false
})
const opcoes = computed<{ value: string; label: string }[]>(() =>
  (estado.value?.valueOptions ?? []).map((i: any) => ({ value: i.value, label: i.label.asString })),
)
const valor = computed<string[]>(() => {
  const bruto = estado.value?.value
  if (bruto === null || bruto === undefined) return []
  return Array.isArray(bruto) ? bruto : [String(bruto)]
})

const filhos = computed<any[]>(() => estado.value?.children ?? [])

const campo = ref<HTMLInputElement | null>(null)
const valorLocal = ref('')

function paraTexto(bruto: unknown): string {
  if (bruto === null || bruto === undefined) return ''
  return String(bruto)
}

watch(
  () => estado.value?.value,
  (novo) => {
    const texto = paraTexto(Array.isArray(novo) ? novo[0] : novo)
    // Enquanto o campo está em foco, o DOM manda: sobrescrever aqui é o que
    // trava o teclado.
    if (document.activeElement === campo.value) return
    valorLocal.value = texto
  },
  { immediate: true },
)

function digitar(evento: Event) {
  const alvo = evento.target as HTMLInputElement
  const bruto = alvo.value
  valorLocal.value = bruto

  const tipoValor = props.no.valueType as string
  const convertido =
    tipoValor === 'int' || tipoValor === 'decimal' ? (bruto === '' ? null : Number(bruto)) : bruto

  props.no.setValue(convertido)
  emit('alterou', false)
}

/** Ao sair do campo, aceita normalizações do motor (ex.: aparo de espaços). */
function sairDoCampo() {
  const normalizado = paraTexto(props.no?.currentState?.value)
  if (normalizado !== valorLocal.value) valorLocal.value = normalizado
  emit('alterou', true)
}

function marcarSimples(valorOpcao: string) {
  props.no.selectValue(valorOpcao)
  emit('alterou', true)
}

function alternarMultiplo(valorOpcao: string) {
  const atuais = new Set(valor.value)
  if (atuais.has(valorOpcao)) atuais.delete(valorOpcao)
  else atuais.add(valorOpcao)
  props.no.selectValues([...atuais])
  emit('alterou', true)
}
</script>

<template>
  <template v-if="visivel">
    <div v-if="tipo === 'root' || tipo === 'group' || tipo.startsWith('repeat')" class="grupo">
      <p v-if="rotulo" class="grupo-rotulo">{{ rotulo }}</p>
      <NodeView
        v-for="filho in filhos"
        :key="filho.nodeId"
        :no="filho"
        :versao="versao"
        @alterou="(imediato: boolean) => emit('alterou', imediato)"
      />
    </div>

    <p v-else-if="tipo === 'note'" class="nota">{{ rotulo }}</p>

    <div v-else-if="tipo === 'input'" class="campo">
      <label :for="no.nodeId">{{ rotulo }}</label>
      <input
        :id="no.nodeId"
        ref="campo"
        :type="no.valueType === 'int' || no.valueType === 'decimal' ? 'number' : 'text'"
        :inputmode="no.valueType === 'int' ? 'numeric' : undefined"
        autocomplete="off"
        autocapitalize="sentences"
        :value="valorLocal"
        @input="digitar"
        @blur="sairDoCampo"
      />
      <small v-if="no.currentState?.validationState?.violation" class="erro">
        Resposta obrigatória ou inválida
      </small>
    </div>

    <div v-else-if="tipo === 'select'" class="campo">
      <span class="rotulo">{{ rotulo }}</span>
      <label v-for="opcao in opcoes" :key="opcao.value" class="opcao">
        <input
          :type="no.selectType === 'select' ? 'checkbox' : 'radio'"
          :name="no.nodeId"
          :checked="valor.includes(opcao.value)"
          @change="
            no.selectType === 'select' ? alternarMultiplo(opcao.value) : marcarSimples(opcao.value)
          "
        />
        {{ opcao.label }}
      </label>
    </div>

    <p v-else-if="tipo === 'model-value'" class="oculto" aria-hidden="true"></p>

    <p v-else class="aviso-tipo">
      Tipo de campo não suportado neste aparelho: <code>{{ tipo }}</code>.
    </p>
  </template>
</template>

<script lang="ts">
export default { name: 'NodeView' }
</script>

<style scoped>
.grupo { border-left: 3px solid #e3e7e6; padding-left: 12px; margin: 12px 0; }
.grupo-rotulo { font-weight: 600; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.04em; color: #4a5b58; }
.campo { display: grid; gap: 6px; margin: 14px 0; }
.campo label, .rotulo { font-weight: 500; }
.campo input[type='text'], .campo input[type='number'] {
  min-height: 44px; border: 1px solid #c9cfce; border-radius: 8px; padding: 0 10px; font-size: 1rem; width: 100%;
}
.opcao { display: flex; align-items: center; gap: 10px; min-height: 44px; }
.opcao input { width: 22px; height: 22px; }
.nota { background: #eef4f3; border-radius: 8px; padding: 12px; color: #3d4d4a; }
.oculto { display: none; }
.erro { color: #a3231a; font-size: 0.85rem; }
.aviso-tipo { background: #fff4e0; border-radius: 8px; padding: 10px; color: #7a4d00; font-size: 0.9rem; }
</style>
