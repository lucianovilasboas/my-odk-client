# Fixtures do corpus

## Procedência

`xforms/*.xml` são cópias **exatas** do que está publicado no Central em
2026-11-08, projeto 14 (`IFNMG - Almenara - 3`):

| Formulário | Versão | Hash (Central) | Bytes |
|---|---|---|---|
| `form_parte_1` | 1 | `md5:9ad33d7f0aadf506dd8bf3866bfb4352` | 36.094 |
| `form_parte_2` | 1 | `md5:00d83f7dc16eb8e2c1781aca37b96c9d` | 18.207 |

## Dados pessoais

Os anexos reais **não** entram no repositório:

- `pessoas_idosas.csv` contém nome de pessoas entrevistadas.
- `Agentes.csv` contém nome, e-mail e telefone de agentes de campo.

`resources/*.csv` são versões sintéticas com o **mesmo cabeçalho**, para que os
testes validem estrutura sem carregar dado pessoal. Não substituir por cópias
reais.

## Regenerar as fixtures

Somente leitura, pelo App User do projeto 14:

```bash
node --test 'tests/conformance/*.test.mjs'
```

O comando acima **verifica**; para baixar de novo é preciso repetir a coleta em
`/v1/key/<token>/projects/14/forms/{id}.xml` e atualizar `manifest.json` no mesmo
commit — o teste falha se XML e manifesto divergirem.

## O que estes testes provam

Provam que as fixtures descrevem fielmente o publicado e que invariantes do
corpus continuam válidas (`geopoint`, entidade criada uma única vez, CSV como
instância secundária). **Não** provam que motor algum suporta esses recursos:
isso é o gate ENGINE, em `docs/validation/offline-gate.md`.
