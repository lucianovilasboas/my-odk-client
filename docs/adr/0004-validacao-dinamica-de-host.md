# ADR 0004 — Validação dinâmica de host (allowlist opcional)

> **Status:** aceito em 2026-11-09. Revisa o passo 2 da ADR 0003.

## Contexto

O adaptador exigia `ALLOWED_CENTRAL_HOSTS` no `.env` e falhava na inicialização
sem ela. Isso obrigava a configurar à mão um dado que o QR do App User já traz
(`server_url` contendo host, token e projeto) e prendia o deploy a um host fixo.
O `ALLOWED_PROJECT_IDS` já era opcional: vazio aceita qualquer projeto do host.

Ao mesmo tempo, o QR é entrada não confiável. Remover a restrição sem substituto
permitiria SSRF: um QR forjado faria o adaptador buscar loopback, rede privada ou
um endpoint de metadata de nuvem. O `PLAN.md` §12 exige bloqueio de SSRF; a
allowlist era a única barreira, e não havia validação de DNS/IP no caminho.

## Decisão

`ALLOWED_CENTRAL_HOSTS` e `ALLOWED_PROJECT_IDS` passam a ser **opcionais**, e o
`.env` fica reduzido a `IMAGE` e `SESSION_SECRET`.

1. **Allowlist preenchida:** o comportamento atual é preservado. Só os hosts
   listados são aceitos, sem resolução DNS. É o caminho para um Central em rede
   privada, que o `PLAN.md` §12 admite apenas por configuração administrativa
   explícita.
2. **Allowlist vazia (padrão):** o host do QR precisa ser `https` e resolver
   somente para endereços públicos. A cada requisição o adaptador chama
   `getaddrinfo` e recusa o destino se **qualquer** resposta for loopback,
   privada, link-local (inclui `169.254.169.254`), CGNAT, reservada, multicast
   ou não especificada (`ipaddress.is_global` e `is_multicast`). DNS que não
   resolve também recusa, em vez de seguir sem verificar.
3. **Projeto:** vazio aceita qualquer projeto do host permitido; a autorização
   efetiva continua sendo o App User no Central.
4. O cliente HTTP usa `trust_env=False`, para que proxy configurado no ambiente
   não contorne a validação de destino, e continua sem seguir redirecionamentos.

Não há cache próprio de DNS: o cache do sistema respeita o TTL e a revalidação
por requisição mantém a janela de rebinding em milissegundos.

## Alternativas recusadas

| Alternativa | Motivo |
|---|---|
| Manter a allowlist obrigatória | Atrito de configuração e host fixo no repositório; o QR já é a fonte da verdade |
| Remover qualquer validação de host | Abre SSRF e contraria `PLAN.md` §12 |
| Prender o IP validado na conexão (SNI do host) | Fecha a janela de rebinding por completo, mas exige transporte customizado; fica como evolução, não como requisito desta fase |
| Cache próprio de DNS | Enfraquece a proteção e duplica responsabilidade do resolvedor do sistema |

## Consequências

**Positivas**

- Configuração zero: o deploy funciona só com `SESSION_SECRET`, como o Collect.
- Host e projeto vêm do QR, sem editar `.env` para cada Central.
- A proteção contra SSRF passa a valer também para hosts que ninguém listou.
- Quem precisa restringir ou usar rede privada mantém o controle explícito.

**Negativas e riscos aceitos**

- Entre validar o DNS e abrir o TCP resta uma janela de milissegundos para
  rebinding. Mitigada pela revalidação por requisição; fechá-la exige pin de IP.
- Um `getaddrinfo` por requisição (servido pelo cache do sistema). Se virar
  gargalo, a evolução é cache com TTL curto ou IP fixado no transporte.
- O backend deixa de falhar no startup por falta de allowlist; o erro move para
  o momento do QR, com mensagem explícita.
- Central em rede privada deixa de funcionar sem configuração explícita — o que
  é intencional.

## Referências

- `PLAN.md` §10, §12
- `AGENTS.md` §5, §8
- `docs/adr/0003-credencial-por-usuario.md`
- `backend/app/central.py`, `backend/app/settings.py`
