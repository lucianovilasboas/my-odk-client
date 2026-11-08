<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { carregar, comoFormData, restaurar, serializar } from '../engine'
import type { Base } from '../storage'
import NodeView from '../components/NodeView.vue'

const props = defineProps<{ base: Base; xmlFormId: string; localId?: string }>()
const emit = defineEmits<{ (e: 'voltar'): void; (e: 'finalizado'): void }>()

const raiz = ref<any>(null)
const versao = ref(0)
const erro = ref<string | null>(null)
const salvando = ref(false)
const ultimoSalvo = ref<number | null>(null)
const instanceID = ref('')
const localId = ref(props.localId ?? crypto.randomUUID())
const revisao = ref(0)

let temporizador: ReturnType<typeof setTimeout> | null = null

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
    erro.value = `não foi possível salvar: ${String(e)}`
  } finally {
    salvando.value = false
  }
}

function extrairInstanceID(xml: string): string {
  return /<instanceID>([^<]*)<\/instanceID>/.exec(xml)?.[1] ?? ''
}

onMounted(async () => {
  const pacote = await props.base.lerPacote(props.xmlFormId)
  if (!pacote) {
    erro.value = 'pacote não está no aparelho; baixe antes de preencher'
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

async function finalizar() {
  if (!raiz.value) return
  try {
    const xml = await serializar(raiz.value)
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

onBeforeUnmount(() => {
  if (temporizador) {
    clearTimeout(temporizador)
    void salvar()
  }
})
</script>

<template>
  <section>
    <button class="voltar" @click="emit('voltar')">← Voltar</button>

    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>

    <p class="status">
      <span v-if="salvando">Salvando…</span>
      <span v-else-if="ultimoSalvo">Salvo neste aparelho às {{ new Date(ultimoSalvo).toLocaleTimeString('pt-BR') }}</span>
      <span v-else>Nenhuma alteração salva ainda</span>
    </p>

    <NodeView v-if="raiz" :no="raiz" :versao="versao" @alterou="agendarSalvamento" />

    <div class="acoes">
      <button class="primario" :disabled="!raiz" @click="finalizar">Finalizar e enfileirar</button>
    </div>
  </section>
</template>

<style scoped>
.voltar { margin-bottom: 12px; }
.status { font-size: 0.85rem; color: #4a5b58; }
.acoes { margin-top: 24px; }
</style>
