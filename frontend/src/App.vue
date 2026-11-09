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
import FillView from './views/FillView.vue'
import SetupView from './views/SetupView.vue'

type Tela = 'carregando' | 'setup' | 'lista' | 'preenchendo'

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
const mostrarSobre = ref(false)

const preenchendo = ref<{ xmlFormId: string; localId?: string } | null>(null)

const pendentes = computed(() => fila.value.filter((i) => i.estado !== 'confirmado'))

const horaSync = computed(() =>
  ultimaSync.value ? new Date(ultimaSync.value).toLocaleTimeString('pt-BR') : null,
)

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
    const pacote = await base.value.lerPacote(f.xmlFormId)
    if (pacote) disponiveis.add(f.xmlFormId)
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
    aviso.value = 'Sem conexão com o servidor. Os formulários já baixados continuam disponíveis.'
  }

  tela.value = 'lista'
})

async function conectar(qr: string) {
  erro.value = null
  conectando.value = true
  try {
    const sessao = await api.conectar(qr)
    await aplicarSessao(sessao.scope)
    await carregarBase(sessao.workspaceId)
    tela.value = 'lista'
    await sincronizar()
  } catch (e) {
    erro.value = e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)
  } finally {
    conectando.value = false
  }
}

/**
 * Baixa formulários e recursos. Só rebaixa o que mudou: o XML é comparado como
 * texto e cada anexo pelo hash do manifesto — é assim que o dataset
 * `pessoas_idosas.csv` é detectado quando a versão do formulário não muda.
 */
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
          anterior && anterior.hash === recurso.hash
            ? anterior.bytes
            : await api.recurso(recurso.url)
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
      aviso.value = 'Nada novo no servidor. Envie os pendentes para que os cadastros apareçam na Parte 2.'
    }
  } catch (e) {
    erro.value = e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)
    formularios.value = await base.value.listarFormularios()
  } finally {
    sincronizando.value = false
    sincronizacaoTexto.value = ''
  }
}

function iniciar(xmlFormId: string, localId?: string) {
  preenchendo.value = { xmlFormId, localId }
  tela.value = 'preenchendo'
}

function voltar() {
  preenchendo.value = null
  tela.value = 'lista'
  atualizarPainel()
}

function aoFinalizar(enviado: boolean) {
  aviso.value = enviado
    ? 'Enviado e aceito pelo servidor.'
    : 'Salvo neste aparelho. Será enviado quando houver conexão.'
  voltar()
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

async function reconfigurar() {
  if (!base.value || !workspace.value) return

  const atuais = await base.value.listarFila()
  const abertos = atuais.filter((i) => i.estado !== 'confirmado')
  if (abertos.length) {
    erro.value = `Há ${abertos.length} envio(s) pendente(s). Envie antes de reconfigurar este aparelho.`
    return
  }

  const confirmado = window.confirm(
    'Reconfigurar apaga pacotes e rascunhos deste aparelho. Os envios já confirmados não são afetados. Continuar?',
  )
  if (!confirmado) return

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
  mostrarSobre.value = false
  erro.value = null
  tela.value = 'setup'
}
</script>

<template>
  <header class="barra-app">
    <div class="linha">
      <h1>My ODK Client</h1>
      <button
        v-if="tela === 'lista'"
        class="atualizar"
        :disabled="sincronizando"
        @click="sincronizar"
      >
        {{ sincronizando ? 'Atualizando…' : 'Atualizar' }}
      </button>
    </div>
    <p v-if="projeto" class="projeto">{{ projeto }} · projeto {{ projetoId }}</p>
    <p v-if="host" class="detalhe">
      {{ host }}<span v-if="horaSync"> · atualizado {{ horaSync }}</span>
    </p>
    <p v-if="sincronizando && sincronizacaoTexto" class="detalhe">{{ sincronizacaoTexto }}</p>
  </header>

  <main class="app">
    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
    <p v-if="aviso" class="aviso" aria-live="polite">{{ aviso }}</p>

    <section v-if="tela === 'carregando'">Carregando…</section>

    <SetupView
      v-else-if="tela === 'setup'"
      :conectando="conectando"
      :erro="erro"
      @conectar="conectar"
    />

    <section v-else-if="tela === 'lista'">
      <p v-if="!formularios.length" class="aviso">
        Nenhum formulário disponível. Toque em Atualizar quando tiver conexão.
      </p>

      <article v-for="f in formularios" :key="f.xmlFormId" class="cartao">
        <strong>{{ f.name }}</strong>
        <small>
          versão {{ f.version || '—' }}
          <span v-if="disponiveis.has(f.xmlFormId)" class="offline">· no aparelho</span>
        </small>
        <div class="acoes">
          <button
            class="primario"
            :disabled="!disponiveis.has(f.xmlFormId)"
            @click="iniciar(f.xmlFormId)"
          >
            Preencher
          </button>
        </div>
      </article>

      <h2 v-if="rascunhos.length">Rascunhos salvos</h2>
      <article v-for="r in rascunhos" :key="r.localId" class="cartao">
        <strong>{{ r.xmlFormId }}</strong>
        <small>salvo em {{ new Date(r.atualizadoEm).toLocaleString('pt-BR') }}</small>
        <div class="acoes">
          <button @click="iniciar(r.xmlFormId, r.localId)">Continuar</button>
        </div>
      </article>

      <h2 v-if="pendentes.length">Aguardando envio</h2>
      <article v-for="i in pendentes" :key="i.localId" class="cartao">
        <strong>{{ i.xmlFormId }}</strong>
        <small>{{ i.estado }} · tentativas: {{ i.tentativas }}</small>
        <small v-if="i.ultimoErro" class="erro">{{ i.ultimoErro }}</small>
      </article>

      <details class="sobre" :open="mostrarSobre" @toggle="mostrarSobre = !mostrarSobre">
        <summary>Sobre este aparelho</summary>
        <p class="aviso">
          Este aparelho está vinculado a um agente. Para usar outro agente, é
          necessário um aparelho diferente.
        </p>
        <button @click="reconfigurar">Reconfigurar aparelho</button>
      </details>

      <div class="acoes fixas">
        <button class="primario" :disabled="!pendentes.length || enviando" @click="enviarPendentes">
          {{ enviando ? 'Enviando…' : `Enviar pendentes (${pendentes.length})` }}
        </button>
      </div>
    </section>

    <FillView
      v-else-if="tela === 'preenchendo' && preenchendo"
      :base="base!"
      :xml-form-id="preenchendo.xmlFormId"
      :local-id="preenchendo.localId"
      @voltar="voltar"
      @finalizado="aoFinalizar"
    />
  </main>
</template>

<style>
:root {
  --teal: #0a3e3d;
  --ambar: #f2a33c;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: #f5f6f6;
  color: #12211f;
  padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
.barra-app {
  background: var(--teal);
  color: #fff;
  padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
}
.barra-app .linha { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.barra-app h1 { font-size: 1.1rem; margin: 0; font-weight: 600; }
.barra-app .projeto { margin: 4px 0 0; font-size: 0.85rem; opacity: 0.95; }
.barra-app .detalhe { margin: 2px 0 0; font-size: 0.75rem; opacity: 0.72; }
.barra-app .atualizar {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 0.9rem;
  white-space: nowrap;
}
.app { max-width: 720px; margin: 0 auto; padding: 16px 16px 96px; }
h2 { font-size: 1rem; margin-top: 24px; }
button {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid #c9cfce;
  background: #fff;
  font-size: 0.95rem;
}
button.primario { background: var(--teal); border-color: var(--teal); color: #fff; }
button:disabled { opacity: 0.5; }
.cartao { background: #fff; border-radius: 10px; padding: 12px; margin: 8px 0; display: grid; gap: 4px; }
.acoes { display: flex; gap: 8px; flex-wrap: wrap; }
.acoes.fixas {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid #e3e7e6;
}
.acoes.fixas button { width: 100%; }
.offline { color: #2c7a5a; }
.erro { color: #a3231a; }
.aviso { color: #4a5b58; }
.sobre { margin-top: 32px; }
.sobre summary { cursor: pointer; color: #4a5b58; padding: 8px 0; }
</style>
