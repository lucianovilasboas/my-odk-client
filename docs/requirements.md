# Requisitos e escopo do piloto

> **Status:** template da Fase 0 — **não preenchido**. O gate **G0 não está aprovado**.
> Nada neste documento pode ser usado para alegar homologação institucional.
> Fonte de verdade: `PLAN.md` (§15 Fase 0, §19 pendências).

## 1. Como usar

Cada seção traz as perguntas em aberto e uma tabela para preenchimento. Substituir
`PENDENTE` pela resposta com **data** e **responsável**. Não remover a coluna
`fonte`: ela registra de onde veio o dado (formulário, Central, aparelho, política).

## 2. Formulários essenciais do piloto

Incluir o formulário mais complexo e o maior do portfólio, não apenas os simples.

| # | Formulário | `xmlFormId` | Versão | Por que é essencial | Fonte | Autorizado por |
|---|---|---|---|---|---|---|
| 1 | Formulário - Parte 1 (cadastro + socioeconômico) | `form_parte_1` | 1 | Cria a entidade `pessoas_idosas` usada pela Parte 2 | Central, projeto 14 | Pendente de registro formal |
| 2 | Formulário - Parte 2 (direitos da pessoa idosa) | `form_parte_2` | 1 | Consome `pessoas_idosas.csv` e `Agentes.csv` | Central, projeto 14 | Pendente de registro formal |

Inventário completo em `tests/fixtures/manifest.json`. XML publicados em
`tests/fixtures/xforms/` (cópia exata, sem token). Os CSV reais contêm dados
pessoais e **não** entram no repositório; as fixtures usam versões sintéticas.

## 3. Inventário de recursos por formulário

Classificação obrigatória por formulário × recurso: `suportado` (entra no MVP),
`bloqueado` (impede coleta daquele formulário) ou `fora do piloto`.
Silêncio não é classificação.

| Recurso | Presente no corpus? | Essencial? | Tratamento | Observação |
|---|---|---|---|---|
| Tipos básicos (texto, número, data, hora, nota, seleção) | sim | sim | suportado | 31 `select_one` + 3 `select_multiple` + 12 `text` + 5 `integer` na P1 |
| Expressões XPath (relevância, cálculo, constraint) | sim | sim | provar no gate | `instance()`, `jr:choice-name()`, `normalize-space()`, `concat()`, `if()`, `selected()` |
| Grupos e repeats (incluindo aninhados) | grupos sim, repeats não | sim | suportado | 7 grupos na P1 (aninhados), 2 na P2; zero repeats |
| Idiomas / traduções | não | não | fora do MVP | formulários em idioma único |
| Anexos de enunciado (imagem, áudio, vídeo) | não | não | fora do MVP | nenhuma coluna `media::` nos XLSX |
| CSVs / listas externas | sim | sim | provar no gate | `Agentes.csv` nas duas partes |
| Entities — leitura (snapshot) | sim | sim | provar no gate | `pessoas_idosas.csv` na P2, 95 registros hoje |
| Entities — criação/atualização offline | criação sim | sim | provar no gate | P1 cria `pessoas_idosas`; hoje **sem propriedades** no XML publicado |
| Criptografia de submissão | não | não | fora do MVP | ausência de chave pública |
| Auditoria (`audit.csv`) | não | não | fora do MVP | ausência de metadado `audit` |
| Foto / arquivo | não | não | fora do MVP | — |
| Áudio / vídeo de resposta | não | não | fora do MVP | — |
| Geopoint | sim | sim | suportado | `type=gps` compila para `geopoint` (confirmado no XML) |
| Geotrace / geoshape | não | não | fora do MVP | — |
| Mapas offline | não | não | fora do MVP | — |
| Barcode / QR de pergunta | não | não | fora do MVP | QR existe apenas como configuração de projeto |
| Assinatura / desenho | não | não | fora do MVP | — |
| Consulta HTTP externa no formulário | não | não | fora do MVP | — |
| Intents / apps externos / hardware | não | não | fora do MVP | — |

## 4. Central de teste e identidades

| Item | Resposta |
|---|---|
| URL do Central de teste | `https://odk.lucianovilasboas.com.br` |
| Versão do Central | não exposta a App User (403 em `/v1/projects/14`) |
| `projectId` autorizado | 14 — "IFNMG - Almenara - 3" |
| App User (nome e escopo) | existente, somente leitura via OpenRosa; sem acesso a endpoints de projeto |
| Conta de verificação separada | PENDENTE |
| Quem autoriza o envio de dados sintéticos | PENDENTE |

Regra: App User não é conta administrativa (§9.1). A verificação de submissões
recebidas usa identidade separada, nunca a mesma do coletor.

## 5. Aparelhos e limites operacionais

| Item | Resposta |
|---|---|
| Android homologado (modelo, versão, navegador) | PENDENTE |
| iOS/iPadOS homologado (modelo, versão) | PENDENTE |
| Desktop homologado (SO, navegador) | PENDENTE |
| Tempo máximo de coleta sem rede | PENDENTE |
| Quantidade máxima de instâncias pendentes | PENDENTE |
| Volume máximo de dados locais | PENDENTE |
| Quantidade/tamanho de fotos por instância | PENDENTE |
| Quantidade/tamanho de áudio/vídeo por instância | PENDENTE |
| Janela de inatividade a testar | PENDENTE |

## 6. Política de dados e proteção local

| Item | Resposta |
|---|---|
| Há dados pessoais/sensíveis no corpus? | PENDENTE |
| Finalidade e base legal | PENDENTE |
| Retenção local após confirmação do Central | PENDENTE |
| Proteção em repouso (aparelho gerenciado vs cofre local) | PENDENTE |
| Recuperação se a chave/senha for perdida | PENDENTE |
| Procedimento de remoção/expurgo | PENDENTE |

Se a proteção em repouso exigir cofre local, isso é gate de segurança (§12) e
muda a Fase 3 — não pode ser adiado para depois do piloto.

## 7. Distribuição

| Item | Resposta |
|---|---|
| Acesso privado (VPN/rede institucional) ou público? | PENDENTE |
| Domínio e certificado TLS | PENDENTE |
| Aplicação de loja (Play/App Store) necessária? | PENDENTE |
| Aceita variante híbrida se a PWA falhar no gate? | PENDENTE |

## 8. Recorte do MVP

Registrar o que entra no primeiro lançamento **sem** reduzir o requisito offline.
Cortar tipos de recurso é aceitável; aceitar coleta sem durabilidade não é (§4.1).

| Item | Decisão | Justificativa |
|---|---|---|
| Recursos incluídos | PENDENTE | |
| Recursos bloqueados no piloto | PENDENTE | |
| Recursos que exigem prova na Fase 1 | PENDENTE | |

## 9. Checklist do gate G0

- [ ] Corpus real autorizado e anonimizado disponível
- [ ] Todo recurso do corpus classificado (sem `PENDENTE`)
- [ ] Central de teste e identidades confirmados
- [ ] Matriz de aparelhos e limites operacionais definidos
- [ ] Política de dados e proteção local aprovada
- [ ] Recorte do MVP aprovado explicitamente pelo responsável
- [ ] `tests/fixtures/manifest.json` preenchido

Sem todos os itens acima, a Fase 1 continua restrita a formulários sintéticos e
**não** pode alegar homologação institucional (§15, Gate G0).
