# ADR 0003 — Credencial por agente, sessão com cookie cifrado

> **Status:** aceito em 2026-11-08.

## Contexto

O primeiro desenho da Fase 2a colocava um único `CENTRAL_APP_USER_TOKEN` no
`.env` do servidor. Isso concentraria **todas as submissões em uma só identidade**
no Central, perderia auditoria por agente e faria uma revogação derrubar todos os
usuários de uma vez.

O plano original já previa o modelo correto (`PLAN.md` §1.1 item 2 e RF01): o
backend entra apenas no cadastro de credenciais, via QR.

Restrição técnica descoberta em teste: o Central **não responde CORS**
(`GET` sem `Access-Control-Allow-Origin`; `OPTIONS` de preflight retorna `404`).
Portanto o token não pode ir do navegador direto ao Central — precisa passar pelo
adaptador.

## Decisão

### 1. Um App User por agente

Cada agente recebe seu próprio App User no Central e configura o aparelho lendo o
QR correspondente. A auditoria do Central passa a refletir quem coletou.

### 2. O token é trocado por sessão, nunca guardado no cliente

```
POST /api/v1/connections  { qr: "<conteúdo do QR>" }
  1. extrai host, token e projectId da server_url /v1/key/<token>/projects/{id}
  2. valida o host contra allowlist (anti-SSRF)
  3. confirma o acesso chamando o formList do Central com esse token
  4. workspaceId = HMAC-SHA256(SESSION_SECRET, token), truncado
  5. devolve cookie cifrado + { connectionId, workspaceId, scope }
```

O cliente guarda **apenas** o `workspaceId`. O token não é escrito em
`localStorage`, IndexedDB, log ou diagnóstico.

### 3. Sessão sem banco

O cookie `HttpOnly; Secure; SameSite=Strict; Path=/` contém
`{ v, token, host, projectId, exp }` cifrado com AES-GCM usando `SESSION_SECRET`.
O adaptador decifra a cada requisição autenticada. Nenhum token em claro é
persistido no servidor e não há tabela de sessões no baseline.

### 4. Isolamento por agente no aparelho

`workspaceId` particiona o armazenamento local. Trocar de agente no mesmo
aparelho não expõe rascunhos, anexos ou fila do anterior (`PLAN.md` §7.1).

### 5. Offline não depende da sessão

Sessão vale para baixar formulários e enviar. Preencher, salvar e reabrir
continuam funcionando sem cookie válido (`PLAN.md` §8.3). Sessão expirada no
campo gera `AUTH_REQUIRED` no envio, com a fila intacta.

## Alternativas recusadas

| Alternativa | Motivo |
|---|---|
| Token único no `.env` | Perde auditoria, revogação global, contraria RF01 |
| Token no cliente a cada request | Exposição a XSS; credencial em trânsito constante |
| Chamada direta ao Central | Bloqueada por CORS |
| Tabela de sessões no banco | Complexidade sem ganho no baseline; cookie cifrado basta |

## Consequências

**Positivas**

- Auditoria correta por agente; revogação individual.
- Token inalcançável por JavaScript após a configuração.
- Sem banco de sessões; o adaptador continua stateless.
- Um aparelho pode ser usado por vários agentes com dados isolados.

**Negativas e riscos aceitos**

- Configuração inicial obrigatória por aparelho (escanear ou colar o QR).
- Rotacionar `SESSION_SECRET` invalida todas as sessões e exige novo QR em cada
  aparelho — precisa constar no runbook de releases.
- XSS continua permitindo chamadas em nome do usuário; mitigar com CSP restritiva,
  expiração curta (12 h) e nenhum script de terceiros.
- Administração do Central passa a criar um App User por agente.

## Referências

- `PLAN.md` §1.1, §6.1, §7.1, §8.3, §10, §22
- `docs/requirements.md` §7
- `deploy/compose.yaml`
