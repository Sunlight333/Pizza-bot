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

# Fail-fast guard. Real incident 2026-05-24: an interrupted Vite build
# left dist/ with only the public/ assets (favicon, images) but no
# index.html or assets/*.js. The deploy continued, nginx kept serving
# the broken dist, and the site returned 500 to every customer until
# we noticed. Refuse to proceed if the canonical Vite outputs are
# missing — the running site stays on whatever it was before.
if [ ! -f "$PROJECT_DIR/frontend/dist/index.html" ] || [ ! -d "$PROJECT_DIR/frontend/dist/assets" ]; then
    echo "[deploy] FATAL: Vite build did not produce dist/index.html or dist/assets/."
    echo "[deploy] Aborting — production frontend is unchanged. Investigate the build log above."
    exit 1
fi

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
