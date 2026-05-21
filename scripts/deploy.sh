#!/usr/bin/env bash
#
# Production deploy: pull, rebuild, migrate, restart.
# Run on the VPS:  ./scripts/deploy.sh
# Or remotely:     ssh deploy@vps 'cd /opt/pizzabot && git pull && ./scripts/deploy.sh'
#
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
COMPOSE="docker compose -f docker-compose.prod.yml"

cd "$PROJECT_DIR"

echo "[deploy] git pull"
git pull --ff-only

echo "[deploy] building unified frontend (Management + Customer Portal)"
# VITE_* env vars are inlined at build time. The vite config doesn't set
# envDir, so by default it only looks in frontend/ and process.env of the
# build container — NOT /opt/pizzabot/.env. We source the project .env
# and forward every VITE_-prefixed var into the container, so the bundle
# gets the live keys without us having to create a second .env file.
VITE_ENV_ARGS=()
if [ -f .env ]; then
  set -a; . ./.env; set +a
  while IFS='=' read -r k _; do
    [[ "$k" == VITE_* ]] && VITE_ENV_ARGS+=("-e" "$k")
  done < <(grep -E '^VITE_[A-Z0-9_]+=' .env)
fi
docker run --rm "${VITE_ENV_ARGS[@]}" -v "$PROJECT_DIR/frontend":/app -w /app node:20-alpine \
  sh -c "npm ci --no-audit --no-fund && npm run build"

echo "[deploy] rebuilding backend image"
$COMPOSE build backend

echo "[deploy] running migrations"
$COMPOSE run --rm backend alembic upgrade head

echo "[deploy] restarting services"
$COMPOSE up -d

echo "[deploy] reloading nginx"
$COMPOSE exec nginx nginx -s reload || true

echo "[deploy] done"
$COMPOSE ps
