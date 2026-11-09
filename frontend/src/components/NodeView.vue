<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * Renderizador mínimo do corpus: grupos, notas, texto, inteiro, geopoint e
 * seleção simples/múltipla.
 *
 * O campo de texto é **não controlado**: o valor do motor nunca é reescrito
 * enquanto o campo está em foco. Reescrever no meio da digitação fecha o
 * teclado no Android e perde a composição do IME.
 *
 * Cada pergunta é montada com `:key` no pai, então este componente nunca é
 * reaproveitado entre perguntas — era isso que fazia o valor de um campo
 * aparecer no próximo.
 */

const props = defineProps<{ no: any; versao: number }>()
const emit = defineEmits<{ (e: 'alterou', imediato: boolean): void }>()

const tipo = computed(() => props.no?.nodeType as string)
const tipoValor = computed(() => props.no?.valueType as string)
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

const gps = computed(() => {
  void props.versao
  const v = props.no?.currentState?.value
  return v && typeof v === 'object' ? v : null
})
const capturando = ref(false)
const erroGps = ref<string | null>(null)

function paraTexto(bruto: unknown): string {
  if (bruto === null || bruto === undefined) return ''
  return String(bruto)
}

watch(
  () => estado.value?.value,
  (novo) => {
    const texto = paraTexto(Array.isArray(novo) ? novo[0] : novo)
    // Enquanto o campo está em foco, o DOM manda.
    if (document.activeElement === campo.value) return
    valorLocal.value = texto
  },
  { immediate: true },
)

function digitar(evento: Event) {
  const alvo = evento.target as HTMLInputElement
  const bruto = alvo.value
  valorLocal.value = bruto

  const convertido =
    tipoValor.value === 'int' || tipoValor.value === 'decimal'
      ? bruto === ''
        ? null
        : Number(bruto)
      : bruto

  props.no.setValue(convertido)
  emit('alterou', false)
}

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

function capturarLocalizacao() {
  erroGps.value = null

  if (!navigator.geolocation) {
    erroGps.value = 'Este aparelho não oferece geolocalização.'
    return
  }

  capturando.value = true
  navigator.geolocation.getCurrentPosition(
    (posicao) => {
      const { latitude, longitude, altitude, accuracy } = posicao.coords
      props.no.setValue(`${latitude} ${longitude} ${altitude ?? 0} ${accuracy}`)
      capturando.value = false
      emit('alterou', true)
    },
    (falha) => {
      capturando.value = false
      erroGps.value =
        falha.code === falha.PERMISSION_DENIED
          ? 'Permissão de localização negada. Autorize nas configurações do navegador.'
          : 'Não foi possível obter a localização. Tente em local aberto.'
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
  )
}

function limparLocalizacao() {
  props.no.setValue(null)
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

    <div v-else-if="tipo === 'input' && tipoValor === 'geopoint'" class="campo">
      <span class="rotulo">{{ rotulo }}</span>
      <p v-if="gps" class="coordenadas">
        {{ gps.latitude.toFixed(5) }}, {{ gps.longitude.toFixed(5) }}
        <small>· precisão {{ Math.round(gps.accuracy) }} m</small>
      </p>
      <p v-else class="sem-localizacao">Nenhuma localização capturada.</p>
      <div class="acoes-gps">
        <button type="button" :disabled="capturando" @click="capturarLocalizacao">
          {{ capturando ? 'Capturando…' : gps ? 'Capturar de novo' : 'Capturar localização' }}
        </button>
        <button v-if="gps" type="button" class="secundario" @click="limparLocalizacao">Limpar</button>
      </div>
      <small v-if="erroGps" class="erro" role="alert">{{ erroGps }}</small>
    </div>

    <div v-else-if="tipo === 'input'" class="campo">
      <label :for="no.nodeId">
        {{ rotulo }}<span v-if="estado?.required" class="obrigatorio" aria-hidden="true"> *</span>
      </label>
      <input
        :id="no.nodeId"
        ref="campo"
        :type="tipoValor === 'int' || tipoValor === 'decimal' ? 'number' : 'text'"
        :inputmode="tipoValor === 'int' ? 'numeric' : undefined"
        autocomplete="off"
        :value="valorLocal"
        @input="digitar"
        @blur="sairDoCampo"
      />
      <small v-if="estado?.validationState?.violation" class="erro">
        Resposta obrigatória ou inválida
      </small>
    </div>

    <div v-else-if="tipo === 'select'" class="campo">
      <span class="rotulo">
        {{ rotulo }}<span v-if="estado?.required" class="obrigatorio" aria-hidden="true"> *</span>
      </span>
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
.obrigatorio { color: #a3231a; }
.aviso-tipo { background: #fff4e0; border-radius: 8px; padding: 10px; color: #7a4d00; font-size: 0.9rem; }
.coordenadas { margin: 0; font-variant-numeric: tabular-nums; }
.sem-localizacao { margin: 0; color: #4a5b58; font-size: 0.9rem; }
.acoes-gps { display: flex; gap: 8px; flex-wrap: wrap; }
.secundario { background: transparent; border-color: #c9cfce; }
</style>
