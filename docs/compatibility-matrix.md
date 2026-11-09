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

**iPhone — iOS 27.2.1, 09/11/2026 — app instalado na Tela de Início:**

Passou em: instalação, configuração por QR, download de pacote, coleta, abertura
fria sem rede **após reiniciar o aparelho**, restauração do rascunho no mesmo
ponto e envio automático ao reconectar.

**Em aba do Safari, sem instalar, a mesma abertura offline falhou:** a página não
carregou até a rede voltar, ficando em carregamento indefinido. Repetido após a
instalação, passou.

Conclusão operacional: **instalar na Tela de Início é requisito, não conveniência**
(`PLAN.md` §22.3). Uso em aba de navegador não entra na matriz.

Falta para "aprovado" completo: `persist()` concedido, atualização de versão com
pendentes, e o modelo do aparelho (a registrar).
A entrega é PWA: sem **instalação pelo ícone** e **abertura offline pelo ícone**,
a plataforma não entra na matriz, mesmo que o site funcione no navegador
(`PLAN.md` §22).

## 2. Plataformas

| Plataforma | Estratégia | Instala pelo ícone | Abre offline pelo ícone | Abertura fria offline | Rascunho após reboot | `persist()` concedido | Atualiza sem perder dados | Envio ao reabrir | Status |
|---|---|---|---|---|---|---|---|---|---|
| Android + Chrome (versão a definir) | PWA instalada | não testado | não testado | não testado | não testado | não testado | não testado | não testado | não homologado |
| iPhone/iPad + Safari | **em homologação** | testado | não testado | não testado | não testado | não testado | não testado | não testado | em homologação |
| Desktop Chrome/Edge | desenvolvimento apenas | não testado | não testado | não testado | não testado | não testado | não testado | não testado | não homologado |
| Desktop Firefox/Safari | desenvolvimento apenas | — | — | — | — | — | — | — | não homologado |
| WebView / navegador embutido | fora da matriz | — | — | — | — | — | — | — | não suportado |
| Distribuição híbrida (futura) | contingência nomeada | — | — | — | — | — | — | — | não avaliado |

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
