# ADR 0002 — PWA como forma de entrega e isolamento da implantação

> **Status:** aceito em 2026-11-08.
> Complementa `PLAN.md` §6.4 e §22.

## Contexto

O plano descrevia a interface como "SPA instalável como PWA", o que deixava a
instalabilidade como detalhe de implementação. A revisão do usuário fixou dois
pontos:

1. A entrega é **PWA** — aplicativo instalado no aparelho, aberto pelo ícone, sem
   barra de navegador, funcionando offline como um app local.
2. O cliente **não roda na stack do ODK Central**, para não comprometer a
   operação do Central.

Em paralelo, a sondagem do Central mostrou que ele **não responde CORS**
(`GET` sem `Access-Control-Allow-Origin`; `OPTIONS` de preflight retorna `404`).
Isso já tornava obrigatório um adaptador de mesma origem para a PWA.

## Decisão

**Entrega:** PWA instalável, servida na origem `odk-cliente.lucianovilasboas.com.br`,
com manifesto, ícones (incluindo maskable) e service worker com precache do shell
e cache do pacote de formulário. Instalação e abertura offline pelo ícone são
critérios de aceite, não melhorias.

**Implantação:** stack própria no host dedicado `ovm-1`, atrás de **Traefik** com
certificado próprio. Nenhum compartilhamento com o Central: sem imagem, volume,
rede Docker, banco, Redis, vhost ou usuário de serviço em comum. A comunicação com
o Central é HTTPS público, como o Collect faz.

A PWA e `/api` vivem na mesma origem, para não introduzir um segundo problema de
CORS entre o cliente e o adaptador.

## Alternativas consideradas

| Alternativa | Motivo da recusa |
|---|---|
| SPA não instalável | Não atende "aplicativo no aparelho"; depende do navegador aberto |
| PWA servida por path do Central | Acopla o cliente ao vhost do Central; um reload de config afeta os dois |
| Containers dentro do compose do Central | Exatamente o risco que a decisão quer evitar |
| Chamada direta da PWA ao Central | Bloqueada por CORS; expõe o token no navegador |
| App nativo Android/iOS | Custo e distribuição por loja; fica como contingência se a PWA falhar no gate |

## Consequências

**Positivas**

- Um único código para Android, iOS e desktop; instalação sem loja.
- Atualização do cliente nunca reinicia o Central; queda do cliente não impede
  coleta offline.
- Credencial de App User permanece no servidor, fora do navegador.

**Negativas e limites**

- iOS não tem Background Sync: envio ao reabrir, explícito na interface.
- Persistência de storage é heurística em algumas plataformas; `persist()` é
  diagnóstico, não garantia.
- Troca de domínio muda a origem e torna o armazenamento anterior inacessível.
- Um host compartilhado exige limites de recurso para não afetar vizinhos.

## Escopo do primeiro ciclo

Somente **Android**. iPhone/iPad permanece "não homologado" na matriz até haver
aparelho disponível. Desktop serve para desenvolvimento.

## Referências

- `PLAN.md` §6.4, §22, §2.4, §8.3
- `docs/requirements.md` §7, §7.1
- `docs/compatibility-matrix.md`
