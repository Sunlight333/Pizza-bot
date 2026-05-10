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

echo "[deploy] building admin frontend"
docker run --rm -v "$PROJECT_DIR/frontend":/app -w /app node:20-alpine \
  sh -c "npm ci --no-audit --no-fund && npm run build"

# Customer portal — separate Vite app served by host nginx at /pedir/
# (see /etc/nginx/sites-enabled/planaltopizzasesorvetes for the location
# block). dist/ is read directly from the host filesystem; no container.
if [ -d "$PROJECT_DIR/customer" ]; then
  echo "[deploy] building customer portal"
  docker run --rm -v "$PROJECT_DIR/customer":/app -w /app node:20-alpine \
    sh -c "npm ci --no-audit --no-fund && npm run build"
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
