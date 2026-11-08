# Spike — motor offline (Fase 1)

> **Estado: testes em vermelho por design.** 7 testes, 0 verdes.
> Isso não é build quebrado: é a tarefa F1.3 do `PLAN.md` — o teste que falha
> antes de existir persistência. O gate **G1 não está aprovado** e nenhum
> resultado aqui homologa nada.

## O que este spike precisa provar

| Tarefa (§15) | O que é provado | Onde |
|---|---|---|
| F1.2 | Fixture mínima com lógica, repeat, mídia e CSV | pendente |
| F1.3 | Teste de restauração de rascunho offline | `test/draft-restore.test.js` |
| F1.4 | Serialize/restore e resolução 100% local de recursos | `test/offline-resources.test.js` |
| F1.5 | Pacote + rascunho + anexo persistidos e recuperados | `test/draft-restore.test.js` |

## Rodar

```bash
cd spikes/offline-engine
npm test          # ou: node --test 'test/*.test.js'
```

Saída esperada hoje: todos os testes falhando com `code: 'NOT_IMPLEMENTED'`.
Um teste que passe sem a implementação correspondente é um teste frouxo.

## Decisão ainda aberta

O motor XForms **não está escolhido** (Web Forms × Enketo Express). Nada em
`src/` pode assumir um deles. A decisão e as evidências vão em
`docs/adr/0001-engine-and-platform.md`.

## Fora de escopo deste spike

- Interface de produto, catálogo de formulários, telas de fila.
- Backend, autenticação, envio ao Central (Fase 4).
- Entities offline, criptografia, auditoria (Fase 5, se essenciais em G0).

## Contratos declarados

`src/draft-store.js` e `src/resource-resolver.js` não são implementações: são a
forma do contrato que os testes exigem, com o código de erro esperado em cada
falha. Implementar é torná-los reais; alterar o teste para caber na
implementação é proibido (§8 do `AGENTS.md`).
