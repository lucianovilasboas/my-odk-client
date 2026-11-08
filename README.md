# My ODK Client

Cliente de coleta de campo **offline-first** para ODK Central, entregue como PWA
instalável. Preenche sem rede, salva rascunho no aparelho e envia ao Central
quando houver conexão e sessão válida.

> **Estado:** Fase 2a — prova funcional. Não homologado para uso em campo:
> falta teste em aparelho real, política de retenção e limpeza de dados.
> A especificação completa está em [`PLAN.md`](PLAN.md); as regras de
> implementação em [`AGENTS.md`](AGENTS.md).

## O que já funciona

| Capacidade | Estado |
|---|---|
| Configuração por QR do App User, um por agente | ✅ |
| Sessão em cookie cifrado; token nunca no navegador | ✅ |
| Baixar pacote (XML + CSV) e usar offline | ✅ |
| Preencher com o motor oficial do ODK | ✅ |
| Autosave e retomada de rascunho após recarregar | ✅ |
| Finalizar e enfileirar | ✅ |
| Enviar e confirmar no Central | ✅ (testado via adaptador) |
| Instalar como app (manifesto + service worker) | ✅ |
| Câmera para ler o QR | ⏳ por ora, colar o conteúdo |
| Homologação em Android/iOS | ❌ pendente |

## Arquitetura

```
PWA (Vue 3 + Vite, instalável)
  ├── motor @getodk/xforms-engine  (XPath, relevância, cálculo, CSV)
  ├── IndexedDB                     (pacotes, rascunhos, fila)
  └── /api ──────────────┐
                         ▼
Adaptador (FastAPI)  ── HTTPS ──►  ODK Central
  sessão cifrada, allowlist, sem banco
```

Stack própria, **fora da stack do Central** (`PLAN.md` §6.4). A PWA e `/api`
vivem na mesma origem — o Central não responde CORS.

## Rodar localmente

```bash
# backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
SESSION_SECRET=$(openssl rand -base64 32) \
ALLOWED_CENTRAL_HOSTS=odk.lucianovilasboas.com.br \
ALLOWED_PROJECT_IDS=14 \
COOKIE_SECURE=false STATIC_DIR=../frontend/dist \
.venv/bin/uvicorn app.main:app --port 8099

# frontend (dev, com proxy para /api)
cd frontend && npm install && npm run dev
```

Build de produção: `cd frontend && npm run build`; o backend serve `dist/`.

Testes:

```bash
cd backend && .venv/bin/python -m pytest          # 20 testes
cd spikes/offline-engine && npm test && npm run test:browser
node --test 'tests/conformance/*.test.mjs'         # fixtures do corpus
```

## Deploy

Artefatos em [`deploy/`](deploy/README.md): Traefik, domínio, limites e
variáveis. Aplicar em produção é tarefa separada e autorizada.

## Estrutura

```
backend/           adaptador REST (FastAPI)
frontend/          PWA (Vue 3 + Vite)
deploy/            compose, Dockerfile, .env.example
docs/              requisitos, matriz, ADRs, evidências
spikes/            prova de viabilidade do motor
tests/fixtures/    XML publicados + CSV sintéticos
```
