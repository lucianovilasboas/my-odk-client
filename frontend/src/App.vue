<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { api, ApiError, type Formulario } from './api'
import {
  abrirBase,
  definirWorkspace,
  pedirPersistencia,
  workspaceAtivo,
  type Base,
  type ItemFila,
  type Rascunho,
} from './storage'
import { somErro, somSucesso } from './som'
import { VERSAO } from './versao'
import Icone from './components/Icone.vue'
import FillView from './views/FillView.vue'
import SetupView from './views/SetupView.vue'
import TelaEnviados from './views/TelaEnviados.vue'
import TelaFila from './views/TelaFila.vue'
import TelaFormularios from './views/TelaFormularios.vue'
import TelaProjeto from './views/TelaProjeto.vue'
import TelaRascunhos from './views/TelaRascunhos.vue'

type Tela =
  | 'carregando'
  | 'setup'
  | 'projeto'
  | 'formularios'
  | 'rascunhos'
  | 'fila'
  | 'enviados'
  | 'preenchendo'

const tela = ref<Tela>('carregando')
const erro = ref<string | null>(null)
const aviso = ref<string | null>(null)

const conectando = ref(false)
const sincronizando = ref(false)
const sincronizacaoTexto = ref('')
const ultimaSync = ref<number | null>(null)

const workspace = ref<string | null>(null)
const projeto = ref<string | null>(null)
const projetoId = ref<string | null>(null)
const host = ref<string | null>(null)

const base = ref<Base | null>(null)
const formularios = ref<Formulario[]>([])
const disponiveis = reactive(new Set<string>())
const fila = ref<ItemFila[]>([])
const rascunhos = ref<Rascunho[]>([])
const enviando = ref(false)

const preenchendo = ref<{ xmlFormId: string; localId?: string } | null>(null)

const pendentes = computed(() => fila.value.filter((i) => i.estado !== 'confirmado'))
const enviados = computed(() => fila.value.filter((i) => i.estado === 'confirmado'))
const temAlerta = computed(
  () => Boolean(erro.value) || pendentes.value.some((i) => i.estado === 'erro'),
)

const horaSync = computed(() =>
  ultimaSync.value ? new Date(ultimaSync.value).toLocaleTimeString('pt-BR') : null,
)

const titulo = computed(() => {
  if (tela.value === 'formularios') return 'Formulários'
  if (tela.value === 'rascunhos') return 'Rascunhos'
  if (tela.value === 'fila') return 'Pronto para enviar'
  if (tela.value === 'enviados') return 'Enviado'
  return projeto.value ?? 'My ODK Client'
})

const podeVoltar = computed(() => tela.value !== 'projeto' && tela.value !== 'setup')
const mostrarAtualizar = computed(() => tela.value === 'projeto' || tela.value === 'formularios')

function nomeDoFormulario(xmlFormId: string): string {
  return formularios.value.find((f) => f.xmlFormId === xmlFormId)?.name ?? xmlFormId
}

async function aplicarSessao(scope: { host: string; projectId: string; projectName?: string }) {
  host.value = scope.host
  projetoId.value = scope.projectId
  projeto.value = scope.projectName || `Projeto ${scope.projectId}`
}

async function carregarBase(id: string) {
  workspace.value = id
  definirWorkspace(id)
  base.value = abrirBase(id)
  await atualizarPainel()
  await marcarDisponiveis()
}

async function marcarDisponiveis() {
  if (!base.value) return
  disponiveis.clear()
  for (const f of formularios.value) {
    if (await base.value.lerPacote(f.xmlFormId)) disponiveis.add(f.xmlFormId)
  }
}

async function atualizarPainel() {
  if (!base.value) return
  rascunhos.value = await base.value.listarRascunhos()
  fila.value = await base.value.listarFila()
}

onMounted(async () => {
  await pedirPersistencia().catch(() => false)

  const id = workspaceAtivo()
  if (!id) {
    tela.value = 'setup'
    return
  }

  await carregarBase(id)

  try {
    const sessao = await api.sessao()
    await aplicarSessao(sessao.scope)
    await sincronizar()
  } catch {
    formularios.value = await base.value!.listarFormularios()
    aviso.value = 'Sem conexão com o servidor. Os formulários baixados continuam disponíveis.'
  }

  tela.value = 'projeto'
})

async function conectar(qr: string) {
  erro.value = null
  conectando.value = true
  try {
    const sessao = await api.conectar(qr)
    await aplicarSessao(sessao.scope)
    await carregarBase(sessao.workspaceId)
    tela.value = 'projeto'
    somSucesso()
    await sincronizar()
  } catch (e) {
    erro.value = e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)
    somErro()
  } finally {
    conectando.value = false
  }
}

async function sincronizar() {
  if (!base.value || sincronizando.value) return
  sincronizando.value = true
  erro.value = null
  sincronizacaoTexto.value = 'Verificando formulários…'

  try {
    const { forms } = await api.formularios()
    formularios.value = forms
    await base.value.salvarFormularios(forms)

    let baixados = 0
    for (const [i, formulario] of forms.entries()) {
      sincronizacaoTexto.value = `Preparando ${i + 1} de ${forms.length}…`
      const pacote = await api.pacote(formulario.xmlFormId)
      const existente = await base.value.lerPacote(formulario.xmlFormId)

      const recursos = []
      for (const recurso of pacote.resources) {
        const anterior = existente?.recursos.find((r) => r.nome === recurso.filename)
        const bytes =
          anterior && anterior.hash === recurso.hash ? anterior.bytes : await api.recurso(recurso.url)
        recursos.push({ nome: recurso.filename, bytes, hash: recurso.hash })
      }

      const mudou =
        !existente ||
        existente.xml !== pacote.xml ||
        recursos.some((r) => existente.recursos.find((a) => a.nome === r.nome)?.hash !== r.hash)

      if (mudou) {
        await base.value.salvarPacote({
          xmlFormId: pacote.xmlFormId,
          xml: pacote.xml,
          recursos,
          preparadoEm: Date.now(),
        })
        baixados += 1
      }
      disponiveis.add(formulario.xmlFormId)
    }

    ultimaSync.value = Date.now()
    if (baixados) {
      aviso.value = `${baixados} formulário(s) atualizado(s).`
    } else if (pendentes.value.length) {
      aviso.value = 'Nada novo. Envie os pendentes para que os cadastros apareçam na Parte 2.'
    }
  } catch (e) {
    erro.value = e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)
    formularios.value = await base.value.listarFormularios()
  } finally {
    sincronizando.value = false
    sincronizacaoTexto.value = ''
  }
}

function voltar() {
  if (tela.value === 'formularios' || tela.value === 'rascunhos' || tela.value === 'fila' || tela.value === 'enviados') {
    tela.value = 'projeto'
  }
}

function iniciar(xmlFormId: string, localId?: string) {
  preenchendo.value = { xmlFormId, localId }
  tela.value = 'preenchendo'
}

function sairDoPreenchimento() {
  preenchendo.value = null
  tela.value = 'projeto'
  atualizarPainel()
}

function aoFinalizar(enviado: boolean) {
  aviso.value = enviado
    ? 'Enviado e aceito pelo servidor.'
    : 'Salvo neste aparelho. Será enviado quando houver conexão.'
  sairDoPreenchimento()
}

async function enviarPendentes() {
  if (!base.value) return
  enviando.value = true
  erro.value = null
  for (const item of pendentes.value) {
    try {
      await api.enviar(item.xml)
      await base.value.atualizarItem({
        ...item,
        estado: 'confirmado',
        ultimoErro: undefined,
        atualizadoEm: Date.now(),
      })
    } catch (e) {
      const apiErro = e instanceof ApiError ? e : null
      await base.value.atualizarItem({
        ...item,
        estado: apiErro?.status === 401 ? 'erro' : 'pendente',
        tentativas: item.tentativas + 1,
        ultimoErro: apiErro ? `${apiErro.code}: ${apiErro.message}` : String(e),
        atualizadoEm: Date.now(),
      })
    }
    await atualizarPainel()
  }
  enviando.value = false
  aviso.value = 'Envio concluído. Toque em Atualizar para trazer os cadastros novos.'
}

async function descartar(rascunho: Rascunho) {
  if (!base.value) return

  const nome = nomeDoFormulario(rascunho.xmlFormId)
  const quando = new Date(rascunho.atualizadoEm).toLocaleString('pt-BR')

  if (!window.confirm(`Descartar o rascunho de ${nome}, salvo em ${quando}? As respostas não podem ser recuperadas.`)) {
    return
  }

  await base.value.apagarRascunho(rascunho.localId)
  aviso.value = 'Rascunho descartado.'
  await atualizarPainel()
}

async function reconfigurar() {
  if (!base.value || !workspace.value) return

  const abertos = (await base.value.listarFila()).filter((i) => i.estado !== 'confirmado')
  if (abertos.length) {
    erro.value = `Há ${abertos.length} envio(s) pendente(s). Envie antes de reconfigurar este aparelho.`
    tela.value = 'fila'
    return
  }

  if (!window.confirm('Reconfigurar apaga pacotes e rascunhos deste aparelho. Os envios já confirmados não são afetados. Continuar?')) {
    return
  }

  indexedDB.deleteDatabase(`odk-${workspace.value}`)
  definirWorkspace(null)
  workspace.value = null
  base.value = null
  formularios.value = []
  fila.value = []
  rascunhos.value = []
  disponiveis.clear()
  projeto.value = null
  projetoId.value = null
  host.value = null
  erro.value = null
  tela.value = 'setup'
}
</script>

<template>
  <template v-if="tela === 'preenchendo' && preenchendo">
    <FillView
      :base="base!"
      :xml-form-id="preenchendo.xmlFormId"
      :local-id="preenchendo.localId"
      @voltar="sairDoPreenchimento"
      @finalizado="aoFinalizar"
    />
  </template>

  <SetupView
    v-else-if="tela === 'setup'"
    :conectando="conectando"
    :erro="erro"
    @conectar="conectar"
  />

  <section v-else-if="tela === 'carregando'" class="tela">Carregando…</section>

  <template v-else>
    <header class="cabecalho">
      <div class="linha">
        <button v-if="podeVoltar" class="voltar" aria-label="Voltar" @click="voltar">
          <Icone nome="voltar" />
        </button>
        <h1>{{ titulo }}</h1>
        <span v-if="temAlerta" class="alerta" role="status" aria-label="Atenção">!</span>
        <button
          v-if="mostrarAtualizar"
          class="atualizar"
          :disabled="sincronizando"
          @click="sincronizar"
        >
          {{ sincronizando ? 'Atualizando…' : 'Atualizar' }}
        </button>
      </div>
      <p v-if="tela === 'projeto' && host" class="sub texto-secundario">
        projeto {{ projetoId }} · {{ host }}
        <span v-if="horaSync"> · {{ horaSync }}</span>
      </p>
      <p v-if="sincronizando && sincronizacaoTexto" class="sub texto-secundario">
        {{ sincronizacaoTexto }}
      </p>
    </header>

    <main class="conteudo">
      <p v-if="erro" class="tela erro" role="alert">{{ erro }}</p>
      <p v-else-if="aviso" class="tela sucesso" aria-live="polite">{{ aviso }}</p>

      <TelaProjeto
        v-if="tela === 'projeto'"
        :rascunhos="rascunhos.length"
        :pendentes="pendentes.length"
        :enviados="enviados.length"
        @preencher="tela = 'formularios'"
        @rascunhos="tela = 'rascunhos'"
        @fila="tela = 'fila'"
        @enviados="tela = 'enviados'"
        @reconfigurar="reconfigurar"
      />

      <TelaFormularios
        v-else-if="tela === 'formularios'"
        :formularios="formularios"
        :disponiveis="disponiveis"
        @preencher="iniciar"
      />

      <TelaRascunhos
        v-else-if="tela === 'rascunhos'"
        :rascunhos="rascunhos"
        :nome-do-formulario="nomeDoFormulario"
        @continuar="(r) => iniciar(r.xmlFormId, r.localId)"
        @descartar="descartar"
      />

      <TelaFila
        v-else-if="tela === 'fila'"
        :itens="pendentes"
        :enviando="enviando"
        :nome-do-formulario="nomeDoFormulario"
        @enviar="enviarPendentes"
      />

      <TelaEnviados
        v-else-if="tela === 'enviados'"
        :itens="enviados"
        :nome-do-formulario="nomeDoFormulario"
      />
    </main>

    <footer class="versao texto-secundario">My ODK Client {{ VERSAO }}</footer>
  </template>
</template>

<style scoped>
.cabecalho {
  padding: calc(16px + env(safe-area-inset-top)) 16px 12px;
  max-width: 640px;
  margin: 0 auto;
}
.linha {
  display: flex;
  align-items: center;
  gap: 12px;
}
.linha + .sub { margin-top: 8px; }
h1 {
  flex: 1;
  min-width: 0;
  font-size: 1.45rem;
  line-height: 1.25;
  font-weight: 400;
  overflow-wrap: anywhere;
}
.voltar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 999px;
  background: var(--superficie);
  color: var(--texto);
  box-shadow: var(--sombra);
}
.alerta {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: var(--alerta);
  color: #fff;
  font-weight: 600;
}
.atualizar {
  min-height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: var(--superficie);
  color: var(--texto);
  font-size: 0.9rem;
  box-shadow: var(--sombra);
  white-space: nowrap;
}
.sub {
  margin: 6px 0 0;
  font-size: 0.8rem;
}
.conteudo {
  max-width: 640px;
  margin: 0 auto;
}
.versao {
  margin: 32px auto 0;
  padding: 0 16px 24px;
  text-align: center;
  font-size: 0.72rem;
  letter-spacing: 0.02em;
  opacity: 0.7;
  max-width: 640px;
}
</style>
