# ADR 0001 — Motor XForms e estratégia de plataforma

> **Status:** parcial — motor oficial aprovado em desktop; homologação em aparelho pendente.
> Nenhuma linha de código pode assumir o motor escolhido antes da aprovação
> deste ADR (`AGENTS.md` §0.5).

## Contexto

O requisito primário é coleta offline completa e entrega posterior ao Central
(`PLAN.md` §2.1). Nenhuma das alternativas web disponíveis entrega esse contrato
pronto: rascunho durável, catálogo local e fila persistente são trabalho nosso
em qualquer caminho (§5.1).

Fatos documentais que condicionam a decisão:

1. `getodk/web-forms` foi arquivado; o desenvolvimento migrou para
   `getodk/central-frontend`, com pacotes ainda publicados (§5.1 item 1).
2. A documentação oficial afirma que ODK Web Forms ainda não suporta uso
   offline (§5.1 item 2).
3. Enketo Core não fornece cache offline de rascunhos, transformação de
   formulário nem gestão de URL (§5.1 item 3).
4. No Enketo atual, formulário com chave de criptografia desabilita autosave e
   remove o botão de rascunho (§5.1 item 4).

## Alternativas avaliadas

| Caminho | Benefício | Limite conhecido |
|---|---|---|
| Componente + motor Web Forms oficiais, persistência própria | Reuso de XPath/XForms e alinhamento ao ecossistema | Offline, rascunho e catálogo são nossos; lacunas de Entities offline, barcode, audit e mapas |
| Enketo Express + fila e armazenamento próprios | Canal offline já documentado no ecossistema | Infraestrutura adicional; envio só com formulário aberto; criptografia desabilita autosave |
| Enketo Core isolado | Controle da integração | Não atende sozinho ao requisito offline |
| Formulários web do próprio Central | Menor desenvolvimento possível | Não entrega o contrato offline |
| Motor próprio em TypeScript | Controle integral | Risco semântico e de manutenção inaceitável |
| Porte de JavaRosa para WASM | Possível paridade | Custo desconhecido; não é baseline |

## Critérios de decisão (gate ENGINE, §5.3)

1. Carregar XML e dependências locais com toda requisição de rede bloqueada.
2. Executar XPath, tipos e fluxo do corpus sem divergência significativa.
3. Exportar e restaurar rascunho sem regenerar UUID, defaults ou cálculos temporais.
4. Preservar repeats, idiomas, respostas não visíveis e semântica de nós não relevantes.
5. Serializar XML, metadados e anexos aceitos pelo Central.
6. Expor captura de alterações para autosave.
7. Permitir interceptar submissão e resolução de recursos.
8. Verificar criptografia e Entities separadamente, quando exigidas.

Um motor que renderiza todos os campos mas não restaura rascunho falha no gate.

## Decisão

**Em andamento.** O motor oficial `@getodk/xforms-engine` 1.1.1 (Apache-2.0)
passou nos critérios 1, 2, 3, 5, 7 e 8 do gate, em Chromium, com o corpus real
(`docs/validation/offline-gate.md`). Falta repetir em aparelho Android real.

### Enketo Express — dispensado em 2026-11-08

Não será avaliado, por decisão do usuário, com três justificativas:

1. O motor oficial passou nos critérios que o corpus exige.
2. Enketo Express exigiria infraestrutura adicional (Docker/Redis) sem eliminar
   a necessidade de persistência própria.
3. A tensão documentada entre criptografia e rascunho não se aplica: o corpus não
   usa submissão cifrada.

Risco aceito: se o motor oficial reprovar em aparelho real, a comparação passa a
ser necessária e esta decisão deve ser reaberta.

## Consequências

**PENDENTE.** Registrar o que fica mais caro, o que fica fora do MVP e qual
alternativa é acionada se o gate reprovar.

## Evidências

- `docs/validation/offline-gate.md`
- `spikes/offline-engine/`
