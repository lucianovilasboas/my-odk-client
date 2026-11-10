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
| Configuração por QR do App User (câmera ou colar) | ✅ |
| Som e vibração ao ler o QR e ao conectar | ✅ |
| Bipe de 2,2 kHz com limitador, audível a distância | ✅ |
| Projeto e formulário vêm do QR, como no Collect | ✅ |
| Sessão em cookie cifrado; token nunca no navegador | ✅ |
| Baixar formulários automaticamente ao conectar | ✅ |
| Botão Atualizar: rebaixa só o que mudou (inclusive datasets) | ✅ |
| Preencher com o motor oficial do ODK | ✅ |
| Uma pergunta por tela, com progresso e retorno | ✅ |
| Listas longas com busca (autocomplete), sem acento | ✅ |
| Botões acima da pergunta quando há teclado; Enter avança | ✅ |
| Perguntas dependentes na mesma tela (tipo `field-list`) | ✅ |
| Obrigatórias bloqueiam o avanço | ✅ |
| Geopoint com captura de GPS do aparelho | ✅ |
| Instruções de permissão de localização por plataforma | ✅ |
| Autosave e retomada no mesmo ponto do rascunho | ✅ |
| Descartar rascunho, com confirmação | ✅ |
| Hub com Rascunhos, Pronto para enviar e Enviado | ✅ |
| Tema claro/escuro seguindo o sistema | ✅ |
| Versão visível no rodapé, vinda da tag do build | ✅ |
| Abrir e coletar offline, com o projeto identificado | ✅ |
| Envio automático em primeiro plano, com verificação de alcance | ✅ |
| Diário de tentativas de envio (90 dias ou 500 registros) | ✅ |
| Finalizar e enfileirar | ✅ |
| Finalizar envia na hora se houver rede; senão enfileira | ✅ |
| Enviar e confirmar no Central | ✅ |
| Instalar como app (manifesto + service worker) | ✅ |

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
COOKIE_SECURE=false STATIC_DIR=../frontend/dist \
.venv/bin/uvicorn app.main:app --port 8099

# frontend (dev, com proxy para /api)
cd frontend && npm install && npm run dev
```

Build de produção: `cd frontend && npm run build`; o backend serve `dist/`.

Testes:

```bash
cd backend && .venv/bin/python -m pytest          # 54 testes
cd spikes/offline-engine && npm test && npm run test:browser
node --test 'tests/conformance/*.test.mjs'         # fixtures do corpus
```

## Deploy

```bash
./deploy.sh
```

O script confere pré-requisitos, cria `deploy/.env`, gera o `SESSION_SECRET`,
constrói a imagem, sobe e espera o serviço ficar saudável. Artefatos em
[`deploy/`](deploy/README.md). Aplicar em produção é tarefa separada e
autorizada.

## Estrutura

```
backend/           adaptador REST (FastAPI)
frontend/          PWA (Vue 3 + Vite)
deploy/            compose, Dockerfile, .env.example
docs/              requisitos, matriz, ADRs, evidências
spikes/            prova de viabilidade do motor
tests/fixtures/    XML publicados + CSV sintéticos
```
