# Deploy — ovm-1

> **Estado:** preparação. A aplicação da Fase 2a ainda não existe; não há imagem
> para subir. Este diretório fixa roteamento, domínio e limites para que o deploy
> seja mecânico quando o código existir.
>
> Aplicar em produção é **deploy** e depende de autorização explícita e separada
> (`AGENTS.md` §10).

## Topologia

| Item | Valor |
|---|---|
| Host | `ovm-1` (dedicado) |
| Proxy | Traefik, rede externa `proxy` |
| Domínio | `odk-cliente.lucianovilasboas.com.br` |
| TLS | Let's Encrypt via `certresolver=letsencrypt` |
| Porta interna | `8602` (não usar 8601, ocupada por outro serviço) |
| Limites | 512 MiB, 1 vCPU |

## Isolamento do ODK Central

O cliente **não** entra no compose do Central, não monta volume dele, não fala
com o banco dele e não altera o vhost dele. A comunicação é HTTPS público, como
o Collect faz (`PLAN.md` §6.4).

A única coisa compartilhada é a rede de borda `proxy`, porque é por onde o
Traefik alcança os serviços. Nenhum outro serviço é compartilhado.

## Subir

Na raiz do repositório, numa tag:

```bash
./deploy.sh
```

O script faz o pré-requisito, o `.env`, a imagem, o `up` e o health check. Para
repetir manualmente:

```bash
cd deploy
docker compose build && docker compose up -d
docker compose logs -f app
```

## Projeto e formulário

Não há projeto fixo: o `projectId` vem do QR do App User, como no Collect.
`ALLOWED_CENTRAL_HOSTS` continua obrigatório (proteção contra SSRF);
`ALLOWED_PROJECT_IDS` é opcional e só serve para restringir.

## Verificar

```bash
curl -sI https://odk-cliente.lucianovilasboas.com.br | head -3
curl -s  https://odk-cliente.lucianovilasboas.com.br/api/health
```

Na PWA: instalar pelo ícone, abrir em modo avião e confirmar que a lista de
formulários aparece (`PLAN.md` §22.1).

## Nunca

- colocar este serviço no compose do Central;
- reaproveitar o banco, o Redis ou os volumes do Central;
- criar token de App User no servidor — cada agente configura o seu pelo QR;
- commitar `deploy/.env`.
