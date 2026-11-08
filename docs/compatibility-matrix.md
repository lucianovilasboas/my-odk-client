# Matriz de compatibilidade

> **Status:** template da Fase 0 — **nenhuma plataforma homologada**. Toda célula
> sem evidência registrada é `não testado`, nunca `suportado`.
> Fonte de verdade: `PLAN.md` §14 e §17.

## 1. Regra de leitura

- `não testado` — ausência de evidência. Não é falha, mas também não é suporte.
- `aprovado` — existe evidência em `docs/validation/` com aparelho, SO, navegador,
  versão do app e data.
- `reprovado` — falhou em teste real; exige correção, restrição formal da matriz
  ou decisão de arquitetura (§2.4).

Emulador, WebKit desktop e "funciona na minha máquina" não produzem `aprovado`.

## 2. Plataformas

| Plataforma | Estratégia | Abertura fria offline | Rascunho após reboot | `persist()` concedido | Captura de mídia | Envio ao reabrir | Status |
|---|---|---|---|---|---|---|---|
| Android + Chrome (versão a definir) | PWA instalada | não testado | não testado | não testado | não testado | não testado | não homologado |
| iPhone/iPad + Safari (versão a definir) | PWA na tela inicial | não testado | não testado | não testado | não testado | não testado | não homologado |
| Desktop Chrome/Edge | SPA responsiva | não testado | não testado | não testado | não testado | não testado | não homologado |
| Desktop Firefox/Safari | SPA responsiva | não testado | não testado | não testado | não testado | não testado | não homologado |
| WebView / navegador embutido | fora da matriz inicial | — | — | — | — | — | não suportado |
| Distribuição híbrida (futura) | repositório nativo | — | — | — | — | — | não avaliado |

Observação registrada em §14: a regra de sete dias do WebKit trata de dias de uso
do navegador sem interação com o site, e aplicativo instalado na Tela de Início
tem tratamento distinto. Evitar tanto "o iOS apaga toda PWA em sete dias" quanto
"PWA instalada nunca perde dados".

## 3. Capacidades do motor (a verificar no spike da Fase 1)

| Capacidade | Web Forms (versão a fixar) | Enketo Express (versão a fixar) | Evidência |
|---|---|---|---|
| Renderizar o corpus sem rede | não testado | não testado | PENDENTE |
| Serializar/restaurar rascunho | não testado | não testado | PENDENTE |
| Autosave durante preenchimento | não testado | não testado | PENDENTE |
| Repeats e idiomas preservados no restore | não testado | não testado | PENDENTE |
| Entities offline | não testado | não testado | PENDENTE |
| Criptografia de submissão + rascunho | não testado | não testado | PENDENTE |
| Mapas offline | não testado | não testado | PENDENTE |
| Auditoria `audit.csv` | não testado | não testado | PENDENTE |
| Barcode | não testado | não testado | PENDENTE |

A matriz oficial de `getodk/web-forms` documenta ausência de suporte a
`save as draft`, `offline entities` e mapas offline (§5.1). Isso é ponto de
partida da avaliação, não resultado do nosso teste.

## 4. Limites operacionais homologados

| Item | Limite adotado | Evidência |
|---|---|---|
| Instâncias pendentes | PENDENTE | PENDENTE |
| Dados locais totais | PENDENTE | PENDENTE |
| Tamanho de anexo individual | PENDENTE | PENDENTE |
| Tempo offline contínuo | PENDENTE | PENDENTE |
| Tempo de abertura do app | PENDENTE | PENDENTE |
| Tempo de autosave | PENDENTE | PENDENTE |
