#!/usr/bin/env bash
#
# Deploy do My ODK Client no servidor (ovm-1).
#
# Uso, na raiz do repositório:
#   ./deploy.sh
#
# Idempotente: pode rodar de novo para reconstruir e reiniciar. Não altera o
# ODK Central, não mexe em stack alheia e não sobrescreve um .env existente.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$RAIZ/deploy/.env"
DOMINIO="${DOMINIO:-odk-cliente.lucianovilasboas.com.br}"
CONTAINER="my-odk-client"

info() { printf '\033[1;34m›\033[0m %s\n' "$*"; }
ok() { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
aviso() { printf '\033[1;33m!\033[0m %s\n' "$*"; }
morrer() {
  printf '\033[1;31m✗\033[0m %s\n' "$*" >&2
  exit 1
}

# --------------------------------------------------------------------------- #
info 'conferindo pré-requisitos'

command -v docker >/dev/null 2>&1 || morrer 'docker não encontrado'
docker compose version >/dev/null 2>&1 || morrer 'docker compose v2 não encontrado'
command -v openssl >/dev/null 2>&1 || morrer 'openssl não encontrado (necessário para gerar SESSION_SECRET)'
command -v python3 >/dev/null 2>&1 || morrer 'python3 não encontrado'

[ -f "$RAIZ/deploy/compose.yaml" ] || morrer "rode a partir da raiz do repositório ($RAIZ)"

# --------------------------------------------------------------------------- #
info 'conferindo versão'

if git -C "$RAIZ" describe --exact-match --tags >/dev/null 2>&1; then
  VERSAO="$(git -C "$RAIZ" describe --tags)"
  ok "checkout na tag $VERSAO"
else
  aviso 'o checkout NÃO está em uma tag — deploy de branch móvel não é reprodutível'
  printf '    continuar mesmo assim? [s/N] '
  read -r resposta
  [[ "${resposta:-n}" =~ ^[sS]$ ]] || exit 1
  VERSAO="$(git -C "$RAIZ" rev-parse --short HEAD)"
fi

# --------------------------------------------------------------------------- #
info 'preparando configuração'

if [ -f "$ENV_FILE" ]; then
  ok 'deploy/.env já existe — preservado'
else
  cp "$RAIZ/deploy/.env.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok 'deploy/.env criado a partir do exemplo'
fi

if grep -qE '^SESSION_SECRET=$' "$ENV_FILE"; then
  SEGREDO="$(openssl rand -base64 32)"
  ENV_FILE="$ENV_FILE" SEGREDO="$SEGREDO" python3 - <<'PY'
import os
import pathlib

arquivo = pathlib.Path(os.environ['ENV_FILE'])
conteudo = arquivo.read_text()
arquivo.write_text(conteudo.replace('SESSION_SECRET=\n', f"SESSION_SECRET={os.environ['SEGREDO']}\n"))
PY
  unset SEGREDO
  ok 'SESSION_SECRET gerado'
else
  ok 'SESSION_SECRET já definido'
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

if [ -n "${ALLOWED_CENTRAL_HOSTS:-}" ]; then
  ok "hosts restritos a: $ALLOWED_CENTRAL_HOSTS"
else
  ok 'hosts: qualquer Central https público vindo do QR'
fi
if [ -n "${ALLOWED_PROJECT_IDS:-}" ]; then
  ok "projetos restritos a: $ALLOWED_PROJECT_IDS"
else
  ok 'projetos: qualquer um do host (vem do QR)'
fi

# --------------------------------------------------------------------------- #
info 'conferindo rede do proxy'

docker network inspect proxy >/dev/null 2>&1 ||
  morrer "rede 'proxy' não existe. Crie com: docker network create proxy"

# --------------------------------------------------------------------------- #
info 'construindo imagem'

# A versão exibida na interface vem da tag, nunca digitada à mão.
export VITE_APP_VERSION="$VERSAO"
ok "versão embutida no build: $VITE_APP_VERSION"

cd "$RAIZ/deploy"
docker compose build

# --------------------------------------------------------------------------- #
info 'subindo'

docker compose up -d

# --------------------------------------------------------------------------- #
info 'aguardando o serviço ficar saudável'

for _ in $(seq 1 40); do
  estado="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER" 2>/dev/null || echo ausente)"
  case "$estado" in
    healthy)
      ok 'serviço saudável'
      break
      ;;
    unhealthy)
      docker compose logs --tail=40 app || true
      morrer 'o container ficou unhealthy — veja os logs acima'
      ;;
    ausente)
      morrer 'container não encontrado; veja: docker compose logs app'
      ;;
  esac
  sleep 2
done

[ "${estado:-}" = 'healthy' ] || morrer 'tempo esgotado esperando o serviço ficar saudável'

# --------------------------------------------------------------------------- #
info 'conferindo publicação'

if curl -fsS --max-time 15 "https://$DOMINIO/api/health" >/dev/null 2>&1; then
  ok "https://$DOMINIO responde"
else
  aviso "https://$DOMINIO ainda não responde — o certificado pode levar alguns minutos"
  aviso "diagnóstico: docker logs traefik --tail=50"
fi

cat <<FIM

  Versão:  $VERSAO
  URL:     https://$DOMINIO
  Logs:    cd deploy && docker compose logs -f app
  Parar:   cd deploy && docker compose down

  Próximo passo: abrir no celular, instalar e escanear o QR do App User.

FIM
