<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { carregar, restaurar, serializar } from '../engine'
import type { Base } from '../storage'
import NodeView from '../components/NodeView.vue'

/**
 * Preenchimento com uma pergunta por tela, como no Collect.
 *
 * A lista de páginas é recalculada a cada alteração, porque `relevant` pode
 * esconder perguntas conforme as respostas. O autosave grava o payload inteiro,
 * de modo que fechar o app não perde o que já foi confirmado na tela.
 */

const props = defineProps<{ base: Base; xmlFormId: string; localId?: string }>()
const emit = defineEmits<{ (e: 'voltar'): void; (e: 'finalizado'): void }>()

const raiz = ref<any>(null)
const versao = ref(0)
const indice = ref(0)
const erro = ref<string | null>(null)
const salvando = ref(false)
const ultimoSalvo = ref<number | null>(null)
const instanceID = ref('')
const localId = ref(props.localId ?? crypto.randomUUID())
const revisao = ref(0)

let temporizador: ReturnType<typeof setTimeout> | null = null

function relevante(no: any): boolean {
  const estado = no?.currentState
  return estado?.isRelevant !== false
}

function tipoDe(no: any): string {
  return no?.nodeType ?? ''
}

const paginas = computed<{ no: any; grupo: string }[]>(() => {
  void versao.value
  const lista: { no: any; grupo: string }[] = []

  const visitar = (no: any, grupo: string) => {
    if (!relevante(no)) return
    const tipo = tipoDe(no)

    if (tipo === 'root' || tipo === 'group' || tipo.startsWith('repeat')) {
      const rotulo = no.currentState?.label?.asString || grupo
      for (const filho of no.currentState?.children ?? []) visitar(filho, rotulo)
      return
    }

    if (tipo === 'input' || tipo === 'select' || tipo === 'note') {
      if (tipo === 'note' && !no.currentState?.label) return
      lista.push({ no, grupo })
    }
  }

  visitar(raiz.value, '')
  return lista
})

const total = computed(() => paginas.value.length)
const atual = computed(() => paginas.value[indice.value] ?? null)
const ultima = computed(() => indice.value >= total.value - 1)
const progresso = computed(() => (total.value ? ((indice.value + 1) / total.value) * 100 : 0))

watch(total, (novo) => {
  if (indice.value > novo - 1) indice.value = Math.max(0, novo - 1)
})

function invalido(no: any): boolean {
  const estado = no?.currentState
  if (!estado) return false
  if (estado.validationState?.violation) return true

  const tipo = tipoDe(no)
  if (tipo === 'note') return false
  const valor = estado.value
  if (Array.isArray(valor)) return valor.length === 0 && Boolean(estado.validationState?.required?.valid === false)
  return false
}

function vazio(no: any): boolean {
  const tipo = tipoDe(no)
  if (tipo === 'note') return false
  const valor = no?.currentState?.value
  if (valor === null || valor === undefined || valor === '') return true
  return Array.isArray(valor) && valor.length === 0
}

function agendarSalvamento() {
  versao.value += 1
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(salvar, 600)
}

async function salvar() {
  if (!raiz.value) return
  salvando.value = true
  try {
    const xml = await serializar(raiz.value)
    revisao.value += 1
    await props.base.salvarRascunho({
      localId: localId.value,
      xmlFormId: props.xmlFormId,
      instanceID: instanceID.value,
      revisao: revisao.value,
      xml,
      atualizadoEm: Date.now(),
    })
    ultimoSalvo.value = Date.now()
  } catch (e) {
    erro.value = `Não foi possível salvar: ${String(e)}`
  } finally {
    salvando.value = false
  }
}

function avancar() {
  erro.value = null
  if (atual.value && invalido(atual.value.no)) {
    erro.value = 'Responda esta pergunta para continuar.'
    return
  }
  if (indice.value < total.value - 1) indice.value += 1
}

function voltarPagina() {
  erro.value = null
  if (indice.value > 0) indice.value -= 1
}

async function finalizar() {
  erro.value = null
  const pendente = paginas.value.findIndex((p) => invalido(p.no))
  if (pendente >= 0) {
    indice.value = pendente
    erro.value = 'Ainda há perguntas obrigatórias sem resposta.'
    return
  }

  try {
    const xml = await serializar(raiz.value)
    const emBranco = paginas.value.filter((p) => vazio(p.no)).length
    if (emBranco > 0) {
      const confirmar = window.confirm(
        `Há ${emBranco} pergunta(s) sem resposta. Finalizar mesmo assim?`,
      )
      if (!confirmar) return
    }

    await props.base.enfileirar({
      localId: localId.value,
      xmlFormId: props.xmlFormId,
      xml,
      estado: 'pendente',
      tentativas: 0,
      atualizadoEm: Date.now(),
    })
    emit('finalizado')
  } catch (e) {
    erro.value = String(e)
  }
}

function extrairInstanceID(xml: string): string {
  return /<instanceID>([^<]*)<\/instanceID>/.exec(xml)?.[1] ?? ''
}

onMounted(async () => {
  const pacote = await props.base.lerPacote(props.xmlFormId)
  if (!pacote) {
    erro.value = 'Este formulário não está no aparelho. Baixe antes de preencher.'
    return
  }

  const recursos = new Map(pacote.recursos.map((r) => [r.nome, r.bytes]))

  try {
    if (props.localId) {
      const rascunho = await props.base.lerRascunho(props.localId)
      if (rascunho) {
        raiz.value = await restaurar(pacote.xml, recursos, rascunho.xml)
        revisao.value = rascunho.revisao
        instanceID.value = rascunho.instanceID
        return
      }
    }

    const { instancia } = await carregar(pacote.xml, recursos)
    raiz.value = instancia.root
    instanceID.value = extrairInstanceID(await serializar(instancia))
  } catch (e) {
    erro.value = String(e)
  }
})

onBeforeUnmount(() => {
  if (temporizador) {
    clearTimeout(temporizador)
    void salvar()
  }
})
</script>

<template>
  <section class="coleta">
    <div class="topo">
      <button class="voltar" @click="emit('voltar')" aria-label="Voltar para a lista">←</button>
      <div class="progresso" role="progressbar" :aria-valuenow="indice + 1" :aria-valuemin="1" :aria-valuemax="total">
        <div class="barra" :style="{ width: `${progresso}%` }"></div>
      </div>
      <span class="contagem">{{ total ? `${indice + 1} de ${total}` : '' }}</span>
    </div>

    <p class="salvamento" aria-live="polite">
      <span v-if="salvando">Salvando…</span>
      <span v-else-if="ultimoSalvo">Salvo neste aparelho às {{ new Date(ultimoSalvo).toLocaleTimeString('pt-BR') }}</span>
      <span v-else>Alterações são salvas neste aparelho</span>
    </p>

    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>

    <div v-if="raiz && atual" class="pergunta">
      <p class="grupo">{{ atual.grupo }}</p>
      <NodeView :no="atual.no" :versao="versao" @alterou="agendarSalvamento" />
    </div>

    <nav class="rodape">
      <button :disabled="indice === 0" @click="voltarPagina">Anterior</button>
      <button v-if="!ultima" class="primario" @click="avancar">Próxima</button>
      <button v-else class="primario" @click="finalizar">Finalizar</button>
    </nav>
  </section>
</template>

<style scoped>
.coleta { display: grid; gap: 12px; padding-bottom: 96px; }
.topo { display: flex; align-items: center; gap: 10px; }
.voltar { min-width: 44px; padding: 0; }
.progresso { flex: 1; height: 8px; background: #e3e7e6; border-radius: 999px; overflow: hidden; }
.barra { height: 100%; background: var(--teal); transition: width 0.2s ease; }
.contagem { font-size: 0.8rem; color: #4a5b58; white-space: nowrap; }
.salvamento { margin: 0; font-size: 0.8rem; color: #4a5b58; }
.grupo { text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.75rem; color: #4a5b58; margin: 0 0 8px; }
.pergunta { min-height: 40vh; }
.rodape {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  display: flex; gap: 8px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #e3e7e6;
}
.rodape button { flex: 1; }
.erro { color: #a3231a; margin: 0; }
</style>
