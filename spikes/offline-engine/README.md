# Spike — motor offline (Fase 1)

> **Estado:** núcleo implementado e gate ENGINE executado no motor oficial
> (`@getodk/xforms-engine` 1.1.1) dentro do Chromium. O gate **G1 não está
> aprovado**: falta teste em aparelho real, submissão aceita pelo Central e a
> comparação com Enketo Express.

## Rodar

```bash
cd spikes/offline-engine
npm test            # 8 testes: rascunho (IndexedDB) e recursos locais
npm run test:browser  # gate ENGINE no Chromium, com o corpus publicado
```

`npm run test:browser` precisa de um Chromium instalado. Por padrão usa
`/usr/bin/google-chrome`; sobrescreva com `CHROME_PATH`.

## Resultados

### Núcleo (`npm test`)

| Prova | Teste | Estado |
|---|---|---|
| Rascunho sobrevive a fechar e reabrir | F1.3 | ✅ |
| Restore não regenera `instanceID` | F1.3 | ✅ |
| Anexo sem bytes persistidos não vira "salvo" | §7.2.1 | ✅ |
| Falta de espaço não reporta sucesso | T07 | ✅ |
| Recurso do pacote resolve sem rede | F1.4 | ✅ |
| Recurso ausente falha em vez de buscar fora | §8.1.4 | ✅ |
| Caminho com travessia recusado | §12 | ✅ |
| Recurso duplicado no pacote recusado | §8.1.4 | ✅ |

Rodam sobre `fake-indexeddb`: provam a lógica transacional, **não** a
durabilidade em aparelho real.

### Gate ENGINE (`npm run test:browser`)

Com os XML reais de `form_parte_1` e `form_parte_2` e os CSV sintéticos:

| Critério (§5.3) | Resultado |
|---|---|
| 1. XML + dependências locais com rede bloqueada | ✅ carrega; `fetch` chamado **0** vezes |
| Falha fechada sem o CSV | ✅ `status: failure` em vez de buscar fora |
| 2. XPath: `instance()` e `jr:choice-name()` | ✅ `instance()` devolve `Agente Teste 1` da coluna `Nome`; `jr:choice-name()` devolve o rótulo do município |
| 3. Restore sem regenerar UUID | ✅ id da entidade e `instanceID` idênticos após restaurar |
| 7. Recursos interceptáveis | ✅ via `fetchFormAttachment` |
| Entidade criada no payload | ✅ `<entity dataset="pessoas_idosas" create="true" id="<uuid>">` |
| 4. Repeats/idiomas | não aplicável (corpus não tem) |
| 5. Aceitação pelo Central | ⏳ depende de submissão real (Fase 4) |
| 6. Captura de alterações para autosave | ⏳ `prepareInstancePayload` funciona; falta fio de autosave |

## Achado de interoperabilidade

O motor serializa o atributo como `create="true"`; o pyxform publica
`create="1"`. São o mesmo booleano XPath, mas **a aceitação pelo Central precisa
ser verificada** numa submissão real antes de declarar a entidade suportada.

## Limite encontrado

O motor oficial **não roda em Node**: o bundle traz um módulo Emscripten com
`require` embutido e depende de `DOMParser`/`crypto.randomUUID` em contexto
seguro. Por isso o gate é um teste de navegador, servido por HTTP em `localhost`.
Isso não é limitação do produto, mas define como a suíte precisa ser montada.

## O que falta para fechar o G1

1. Repetir o gate em aparelho Android e iPhone reais.
2. Submissão de teste aceita pelo Central, incluindo a entidade.
3. Comparar com Enketo Express (exige infraestrutura; não avaliado aqui).
