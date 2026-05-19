#!/usr/bin/env bash
# Deploy from your Mac to VPS:
#   export DEPLOY_HOST=root@YOUR_SERVER_IP
#   npm run deploy:vps
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HOST="${DEPLOY_HOST:-}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/diary-bot}"

if [[ -z "$HOST" ]]; then
  echo "Error: set DEPLOY_HOST, e.g. export DEPLOY_HOST=root@203.0.113.10" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "Error: .env not found. Create from env.production.example and fill secrets." >&2
  exit 1
fi

echo "→ Syncing to ${HOST}:${REMOTE_DIR}"
ssh "$HOST" "mkdir -p ${REMOTE_DIR}"

rsync -avz --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  --exclude '.env.*' \
  --exclude data \
  ./ "${HOST}:${REMOTE_DIR}/"

echo "→ Uploading .env (secrets)"
scp -q .env "${HOST}:${REMOTE_DIR}/.env"

echo "→ Building and starting containers"
ssh "$HOST" "cd ${REMOTE_DIR} && docker compose -f docker-compose.prod.yml up -d --build"

echo "→ Health check (on server)"
ssh "$HOST" "sleep 8 && curl -sf http://127.0.0.1:3000/health && echo '' || (docker compose -f ${REMOTE_DIR}/docker-compose.prod.yml logs --tail=40 bot && exit 1)"

echo "Done. Bot should respond in Telegram."
