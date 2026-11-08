# Gate offline e motor — evidências

> **Status:** nenhuma evidência registrada. O gate **G1 não está aprovado**.
> Regra: nenhuma linha `aprovado` sem aparelho real, versão, data e artefato.

## 1. Gate ENGINE (§5.3)

| # | Critério | Web Forms | Enketo Express | Evidência |
|---|---|---|---|---|
| 1 | XML e dependências carregam com rede bloqueada | **aprovado** (Chromium desktop) | não avaliado | `spikes/offline-engine/test/browser/engine-gate.test.js` |
| 2 | XPath, tipos e fluxo sem divergência significativa | **aprovado**: `instance()` devolve valor do CSV e `jr:choice-name()` devolve o rótulo | não avaliado | idem |
| 3 | Exportar/restaurar rascunho sem regenerar UUID/defaults | **aprovado** (`instanceID` e id da entidade estáveis) | não avaliado | idem |
| 4 | Repeats, idiomas e nós não relevantes preservados | não aplicável: corpus sem repeats e com um idioma | não avaliado | — |
| 5 | XML, metadados e anexos aceitos pelo Central | **aprovado**: `201` e entidade criada | não avaliado | `scripts/central-smoke.mjs` |
| 6 | Captura de alterações para autosave | parcial: `prepareInstancePayload` funciona | não avaliado | idem |
| 7 | Submissão e recursos interceptáveis | **aprovado** para recursos (`fetchFormAttachment`) | não avaliado | idem |
| 8 | Criptografia e Entities, quando exigidas | entidade **aprovada** no payload; criptografia não se aplica | não avaliado | idem |

Achado resolvido: o motor escreve `create="true"` onde o pyxform publica
`create="1"`. O Central aceitou a submissão com `201` e criou a entidade, então
as duas grafias do booleano XPath são equivalentes na prática.

Enketo Express **não foi avaliado**: exige infraestrutura própria (Docker/Redis)
e o ADR 0001 continua aberto.

## 2. Contrato offline (§2.1) em aparelho real

Preencher uma linha por execução. `Resultado` só aceita `aprovado` ou
`reprovado`; `não testado` não fecha gate.

| Caso | Aparelho | SO | Navegador/versão | App/commit | Data | Resultado | Evidência |
|---|---|---|---|---|---|---|---|
| T02 — pacote aberto em modo avião | PENDENTE | | | | | não testado | |
| T03 — rascunho após fechar completamente | PENDENTE | | | | | não testado | |
| T04 — reboot sem rede | PENDENTE | | | | | não testado | |
| T06 — falha de gravação durante digitação | PENDENTE | | | | | não testado | |
| T07 — `QuotaExceededError` | PENDENTE | | | | | não testado | |
| T08 — rede cai no download de recurso | PENDENTE | | | | | não testado | |
| T10 — Central recebe, resposta se perde | PENDENTE | | | | | não testado | |
| T24 — iPhone fechado, rede retorna | fora do primeiro ciclo | — | — | — | — | não homologado | |

## 3. Persistência e cota

| Item | Valor observado | Aparelho/versão | Data |
|---|---|---|---|
| `navigator.storage.persist()` concedido? | PENDENTE | | |
| `estimate()` antes/depois da preparação | PENDENTE | | |
| Comportamento com disco cheio | PENDENTE | | |
| Retenção após 7 dias sem uso | PENDENTE | | |
| Retenção após reboot | PENDENTE | | |

## 4. Submissão real

| Item | Valor | Data |
|---|---|---|
| Central de teste | `odk.lucianovilasboas.com.br`, projeto 14 | 2026-11-08 |
| `instanceID` da submissão de prova | `uuid:6e21ebab-d970-4d3b-baab-5600a683c038` | 2026-11-08 |
| Resultado do `POST /submission` | `201` | 2026-11-08 |
| Entidade criada | `662282bf-b1e7-4f23-ae2c-39d58d783d55`, rótulo `TESTE CLIENTE WEB - APAGAR|Bairro Teste-Vitória de Santo Antônio/ac|uuid:6e21ebab…` | 2026-11-08 |
| Lista de entidades antes → depois | 95 → 96 linhas, regenerada sem nova versão do formulário | 2026-11-08 |
| Anexos conferidos por leitura de volta | não aplicável (formulário sem anexo de resposta) | — |
| Identidade usada | App User com permissão de envio | — |
| Registro de teste removido | **pendente** — App User não apaga; remover no Central | — |

## 4.1 Adaptador e PWA (Fase 2a)

Verificado em 2026-11-08 contra o projeto 14, somente leitura:

| Verificação | Resultado |
|---|---|
| `POST /api/v1/connections` com o QR do App User | `200`, `workspaceId` derivado, token ausente da resposta |
| `GET /api/v1/forms` | 2 formulários, sem `key/` nas URLs |
| `GET /api/v1/forms/form_parte_1/package` | XML de 36.094 bytes + `Agentes.csv` |
| PWA no navegador | instala, baixa pacote, preenche, autosave visível |
| Rascunho após recarregar a página | preservado |

## 5. Conclusão do gate

**PENDENTE.** Só preencher quando o ADR 0001 estiver decidido e as tabelas
acima completas. Falha no gate implica ajustar o caminho ou apresentar a
alternativa híbrida — não reduzir o requisito offline em silêncio (§2.4).
