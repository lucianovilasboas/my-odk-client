<script setup lang="ts">
import { computed } from 'vue'

/**
 * Renderizador mínimo do corpus: grupos, notas, texto, inteiro, geopoint e
 * seleção simples/múltipla. Tipos fora dessa lista não são renderizados e
 * devem bloquear a coleta (fail-closed), como manda o PLAN.md §1, invariante 10.
 */

const props = defineProps<{ no: any; versao: number }>()
const emit = defineEmits<{ (e: 'alterou'): void }>()

const tipo = computed(() => props.no?.nodeType as string)
const estado = computed(() => {
  void props.versao // força recálculo quando o motor muda
  return props.no?.currentState
})
const rotulo = computed(() => estado.value?.label?.asString ?? '')
const visivel = computed(() => {
  void props.versao
  return props.no?.currentState?.isRelevant !== false
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

function texto(): string {
  return valor.value[0] ?? ''
}

function digitar(evento: Event) {
  const alvo = evento.target as HTMLInputElement
  const bruto = alvo.value
  const tipoValor = props.no.valueType as string
  const convertido =
    tipoValor === 'int' || tipoValor === 'decimal'
      ? bruto === ''
        ? null
        : Number(bruto)
      : bruto
  props.no.setValue(convertido)
  emit('alterou')
}

function marcarSimples(valorOpcao: string) {
  props.no.selectValue(valorOpcao)
  emit('alterou')
}

function alternarMultiplo(valorOpcao: string) {
  const atuais = new Set(valor.value)
  if (atuais.has(valorOpcao)) atuais.delete(valorOpcao)
  else atuais.add(valorOpcao)
  props.no.selectValues([...atuais])
  emit('alterou')
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
        @alterou="emit('alterou')"
      />
    </div>

    <p v-else-if="tipo === 'note'" class="nota">{{ rotulo }}</p>

    <div v-else-if="tipo === 'input'" class="campo">
      <label :for="no.nodeId">{{ rotulo }}</label>
      <input
        :id="no.nodeId"
        :type="no.valueType === 'int' || no.valueType === 'decimal' ? 'number' : 'text'"
        :value="texto()"
        :inputmode="no.valueType === 'int' ? 'numeric' : undefined"
        @input="digitar"
      />
      <small v-if="no.currentState?.validationState?.valid === false" class="erro">{{ rotulo }} é obrigatório</small>
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
