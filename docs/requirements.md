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
| 1 | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE | PENDENTE |

## 3. Inventário de recursos por formulário

Classificação obrigatória por formulário × recurso: `suportado` (entra no MVP),
`bloqueado` (impede coleta daquele formulário) ou `fora do piloto`.
Silêncio não é classificação.

| Recurso | Presente no corpus? | Essencial? | Tratamento | Observação |
|---|---|---|---|---|
| Tipos básicos (texto, número, data, hora, nota, seleção) | PENDENTE | PENDENTE | PENDENTE | |
| Expressões XPath (relevância, cálculo, constraint) | PENDENTE | PENDENTE | PENDENTE | |
| Grupos e repeats (incluindo aninhados) | PENDENTE | PENDENTE | PENDENTE | |
| Idiomas / traduções | PENDENTE | PENDENTE | PENDENTE | |
| Anexos de enunciado (imagem, áudio, vídeo) | PENDENTE | PENDENTE | PENDENTE | |
| CSVs / listas externas | PENDENTE | PENDENTE | PENDENTE | |
| Entities — leitura (snapshot) | PENDENTE | PENDENTE | PENDENTE | |
| Entities — criação/atualização offline | PENDENTE | PENDENTE | PENDENTE | §13 exige trilha própria |
| Criptografia de submissão | PENDENTE | PENDENTE | PENDENTE | Tensão com rascunho: §5.1 item 4 |
| Auditoria (`audit.csv`) | PENDENTE | PENDENTE | PENDENTE | |
| Foto / arquivo | PENDENTE | PENDENTE | PENDENTE | |
| Áudio / vídeo de resposta | PENDENTE | PENDENTE | PENDENTE | |
| Geopoint / geotrace / geoshape | PENDENTE | PENDENTE | PENDENTE | |
| Mapas offline | PENDENTE | PENDENTE | PENDENTE | |
| Barcode / QR de pergunta | PENDENTE | PENDENTE | PENDENTE | Separado do QR de configuração |
| Assinatura / desenho | PENDENTE | PENDENTE | PENDENTE | |
| Consulta HTTP externa no formulário | PENDENTE | PENDENTE | PENDENTE | Não funciona offline |
| Intents / apps externos / hardware | PENDENTE | PENDENTE | PENDENTE | Fora da promessa PWA |

## 4. Central de teste e identidades

| Item | Resposta |
|---|---|
| URL do Central de teste | PENDENTE |
| Versão do Central | PENDENTE |
| `projectId` autorizado | PENDENTE |
| App User (nome e escopo) | PENDENTE |
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
