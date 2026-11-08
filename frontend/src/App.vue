<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

type Tela = 'carregando' | 'setup' | 'lista' | 'preenchendo'

const tela = ref<Tela>('carregando')
const erro = ref<string | null>(null)
const aviso = ref<string | null>(null)

const qr = ref('')
const conectando = ref(false)
const workspace = ref<string | null>(null)
const base = ref<Base | null>(null)
const formularios = ref<Formulario[]>([])
const fila = ref<ItemFila[]>([])
const rascunhos = ref<Rascunho[]>([])
const enviando = ref(false)

const preenchendo = ref<{ xmlFormId: string; localId?: string } | null>(null)

const pendentes = computed(() => fila.value.filter((i) => i.estado !== 'confirmado').length)

async function carregarBase(id: string) {
  workspace.value = id
  definirWorkspace(id)
  base.value = abrirBase(id)
  await atualizarPainel()
}

async function atualizarPainel() {
  if (!base.value) return
  rascunhos.value = await base.value.listarRascunhos()
  fila.value = await base.value.listarFila()
}

onMounted(async () => {
  await pedirPersistencia().catch(() => false)

  const id = workspaceAtivo()
  if (id) {
    try {
      const sessao = await api.sessao()
      await carregarBase(sessao.workspaceId)
      await carregarFormularios()
      tela.value = 'lista'
      return
    } catch {
      // sessão expirada: segue offline com o workspace anterior
      await carregarBase(id)
      tela.value = 'lista'
      return
    }
  }

  tela.value = 'setup'
})

async function conectar() {
  erro.value = null
  conectando.value = true
  try {
    const sessao = await api.conectar(qr.value.trim())
    await carregarBase(sessao.workspaceId)
    await carregarFormularios()
    tela.value = 'lista'
    qr.value = ''
  } catch (e) {
    erro.value = e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)
  } finally {
    conectando.value = false
  }
}

async function carregarFormularios() {
  if (!base.value) return
  try {
    const { forms } = await api.formularios()
    formularios.value = forms
    await base.value.salvarFormularios(forms)
  } catch {
    formularios.value = await base.value.listarFormularios()
    aviso.value = 'Sem conexão com o servidor. Mostrando os formulários já baixados.'
  }
}

async function baixar(formulario: Formulario) {
  if (!base.value) return
  erro.value = null
  aviso.value = null
  try {
    const pacote = await api.pacote(formulario.xmlFormId)
    const recursos = []
    for (const recurso of pacote.resources) {
      recursos.push({ nome: recurso.filename, bytes: await api.recurso(recurso.url) })
    }
    await base.value.salvarPacote({
      xmlFormId: pacote.xmlFormId,
      xml: pacote.xml,
      recursos,
      preparadoEm: Date.now(),
    })
    aviso.value = `${formulario.name} pronto para uso offline.`
  } catch (e) {
    erro.value = e instanceof ApiError ? `${e.code}: ${e.message}` : String(e)
  }
}

async function iniciar(xmlFormId: string, localId?: string) {
  preenchendo.value = { xmlFormId, localId }
  tela.value = 'preenchendo'
}

function voltar() {
  preenchendo.value = null
  tela.value = 'lista'
  atualizarPainel()
}

async function enviarPendentes() {
  if (!base.value) return
  enviando.value = true
  erro.value = null
  for (const item of fila.value) {
    if (item.estado === 'confirmado') continue
    try {
      await api.enviar(item.xml)
      await base.value.atualizarItem({ ...item, estado: 'confirmado', ultimoErro: undefined, atualizadoEm: Date.now() })
    } catch (e) {
      const apiErro = e instanceof ApiError ? e : null
      const estado = apiErro?.status === 401 ? 'erro' : 'pendente'
      await base.value.atualizarItem({
        ...item,
        estado,
        tentativas: item.tentativas + 1,
        ultimoErro: apiErro ? `${apiErro.code}: ${apiErro.message}` : String(e),
        atualizadoEm: Date.now(),
      })
    }
    await atualizarPainel()
  }
  enviando.value = false
}

async function sair() {
  await api.sair().catch(() => undefined)
  definirWorkspace(null)
  workspace.value = null
  base.value = null
  formularios.value = []
  fila.value = []
  rascunhos.value = []
  tela.value = 'setup'
}
</script>

<template>
  <main class="app">
    <header>
      <h1>My ODK Client</h1>
      <span v-if="pendentes" class="badge">{{ pendentes }} pendente(s)</span>
    </header>

    <p v-if="erro" class="erro" role="alert">{{ erro }}</p>
    <p v-if="aviso" class="aviso">{{ aviso }}</p>

    <section v-if="tela === 'carregando'">Carregando…</section>

    <section v-else-if="tela === 'setup'">
      <h2>Configurar este aparelho</h2>
      <p>
        Cada agente usa o próprio App User. Escaneie o QR do Central ou cole o
        conteúdo dele abaixo.
      </p>
      <textarea v-model="qr" rows="6" placeholder="cole aqui o conteúdo do QR" aria-label="conteúdo do QR" />
      <button :disabled="!qr.trim() || conectando" @click="conectar">
        {{ conectando ? 'Conectando…' : 'Conectar' }}
      </button>
    </section>

    <section v-else-if="tela === 'lista'">
      <h2>Formulários</h2>
      <p v-if="!formularios.length" class="aviso">
        Nenhum formulário baixado. Conecte-se e baixe pelo menos um para usar offline.
      </p>

      <article v-for="f in formularios" :key="f.xmlFormId" class="cartao">
        <strong>{{ f.name }}</strong>
        <small>versão {{ f.version || '—' }}</small>
        <div class="acoes">
          <button @click="baixar(f)">Baixar</button>
          <button class="primario" @click="iniciar(f.xmlFormId)">Preencher</button>
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

      <h2 v-if="fila.length">Aguardando envio</h2>
      <article v-for="i in fila.filter((x) => x.estado !== 'confirmado')" :key="i.localId" class="cartao">
        <strong>{{ i.xmlFormId }}</strong>
        <small>{{ i.estado }} · tentativas: {{ i.tentativas }}</small>
        <small v-if="i.ultimoErro" class="erro">{{ i.ultimoErro }}</small>
      </article>

      <div class="acoes fixas">
        <button class="primario" :disabled="!pendentes || enviando" @click="enviarPendentes">
          {{ enviando ? 'Enviando…' : `Enviar pendentes (${pendentes})` }}
        </button>
        <button @click="sair">Trocar de agente</button>
      </div>
    </section>

    <FillView
      v-else-if="tela === 'preenchendo' && preenchendo"
      :base="base!"
      :xml-form-id="preenchendo.xmlFormId"
      :local-id="preenchendo.localId"
      @voltar="voltar"
      @finalizado="voltar"
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
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
.app { max-width: 720px; margin: 0 auto; padding: 16px 16px 96px; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
h1 { font-size: 1.2rem; }
h2 { font-size: 1rem; margin-top: 24px; }
textarea { width: 100%; font-family: ui-monospace, monospace; font-size: 0.8rem; padding: 8px; }
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
.badge { background: var(--ambar); color: #3a2400; border-radius: 999px; padding: 2px 10px; font-size: 0.8rem; }
.erro { color: #a3231a; }
.aviso { color: #4a5b58; }
</style>
