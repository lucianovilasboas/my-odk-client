# Gate offline e motor — evidências

> **Status:** nenhuma evidência registrada. O gate **G1 não está aprovado**.
> Regra: nenhuma linha `aprovado` sem aparelho real, versão, data e artefato.

## 1. Gate ENGINE (§5.3)

| # | Critério | Web Forms | Enketo Express | Evidência |
|---|---|---|---|---|
| 1 | XML e dependências carregam com rede bloqueada | não testado | não testado | PENDENTE |
| 2 | XPath, tipos e fluxo sem divergência significativa | não testado | não testado | PENDENTE |
| 3 | Exportar/restaurar rascunho sem regenerar UUID/defaults | não testado | não testado | PENDENTE |
| 4 | Repeats, idiomas e nós não relevantes preservados | não testado | não testado | PENDENTE |
| 5 | XML, metadados e anexos aceitos pelo Central | não testado | não testado | PENDENTE |
| 6 | Captura de alterações para autosave | não testado | não testado | PENDENTE |
| 7 | Submissão e recursos interceptáveis | não testado | não testado | PENDENTE |
| 8 | Criptografia e Entities, quando exigidas | não testado | não testado | PENDENTE |

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
| T24 — iPhone fechado, rede retorna | PENDENTE | | | | | não testado | |

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
| Central de teste / versão | PENDENTE | |
| `instanceID` da submissão de prova | PENDENTE | |
| Anexos conferidos por leitura de volta | PENDENTE | |
| Identidade usada na verificação | PENDENTE | |

## 5. Conclusão do gate

**PENDENTE.** Só preencher quando o ADR 0001 estiver decidido e as tabelas
acima completas. Falha no gate implica ajustar o caminho ou apresentar a
alternativa híbrida — não reduzir o requisito offline em silêncio (§2.4).
