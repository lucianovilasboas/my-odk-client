<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SelecaoBusca from './SelecaoBusca.vue'
import { usaCombobox, type MapaAparencias } from '../aparencias'

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

const props = withDefaults(
  defineProps<{ no: any; versao: number; aparencias?: MapaAparencias }>(),
  { aparencias: () => new Map() },
)
const emit = defineEmits<{ (e: 'alterou', imediato: boolean): void; (e: 'avancar'): void }>()

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

/** Lista longa ou `autocomplete` no XLSForm vira combobox com busca. */
const usarBusca = computed(() => {
  void props.versao
  if (tipo.value !== 'select' || props.no?.selectType !== 'select1') return false
  return usaCombobox(
    props.aparencias,
    props.no?.definition?.nodeset ?? null,
    opcoes.value.length,
  )
})

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
        :aparencias="aparencias"
        @alterou="(imediato: boolean) => emit('alterou', imediato)"
        @avancar="emit('avancar')"
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
        enterkeyhint="next"
        :value="valorLocal"
        @input="digitar"
        @blur="sairDoCampo"
        @keydown.enter.prevent="emit('avancar')"
      />
      <small v-if="estado?.validationState?.violation" class="erro">
        Resposta obrigatória ou inválida
      </small>
    </div>

    <SelecaoBusca
      v-else-if="tipo === 'select' && usarBusca"
      :no="no"
      :versao="versao"
      :rotulo="rotulo"
      :obrigatorio="Boolean(estado?.required)"
      @alterou="(imediato: boolean) => emit('alterou', imediato)"
    />

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
.grupo { border-left: 3px solid var(--divisor); padding-left: 14px; margin: 16px 0; }
.grupo-rotulo { font-weight: 600; text-transform: uppercase; font-size: 0.78rem; letter-spacing: 0.05em; color: var(--texto-2); }
.campo { display: grid; gap: 8px; margin: 18px 0; }
.campo label, .rotulo { font-weight: 500; }
.campo input[type='text'], .campo input[type='number'] {
  min-height: 52px; border: 1px solid var(--divisor); border-radius: 12px; padding: 0 14px;
  font-size: 1.05rem; width: 100%; background: var(--superficie); color: var(--texto);
}
.opcao {
  display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 14px;
  border-radius: 12px; background: var(--superficie); box-shadow: var(--sombra);
}
.opcao input { width: 22px; height: 22px; accent-color: var(--acento); }
.nota { background: var(--superficie-2); border-radius: 12px; padding: 16px; color: var(--texto); }
.oculto { display: none; }
.erro { color: var(--erro); font-size: 0.85rem; }
.obrigatorio { color: var(--erro); }
.aviso-tipo { background: var(--superficie-2); border-radius: 12px; padding: 14px; color: var(--texto); font-size: 0.9rem; }
.coordenadas { margin: 0; font-variant-numeric: tabular-nums; }
.sem-localizacao { margin: 0; color: var(--texto-2); font-size: 0.9rem; }
.acoes-gps { display: flex; gap: 10px; flex-wrap: wrap; }
.acoes-gps button {
  min-height: 48px; padding: 0 18px; border-radius: 999px;
  border: 1px solid var(--divisor); background: var(--superficie); color: var(--texto);
}
.secundario { background: transparent; }
</style>
