#!/usr/bin/env bash
#
# Daily Postgres backup with 7-day rotation.
# Add to host crontab:  0 3 * * * /opt/pizzabot/scripts/backup.sh
#
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"

cd "$PROJECT_DIR"

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $PROJECT_DIR"
  exit 1
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a

mkdir -p "$BACKUP_DIR"
TS=$(date -u +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/pizzabot_${TS}.sql.gz"

echo "[backup] dumping $POSTGRES_DB -> $OUT"
docker compose exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
  | gzip > "$OUT"

echo "[backup] cleaning files older than ${KEEP_DAYS} days"
find "$BACKUP_DIR" -name 'pizzabot_*.sql.gz' -type f -mtime +"$KEEP_DAYS" -delete

echo "[backup] done — $(du -h "$OUT" | cut -f1)"
