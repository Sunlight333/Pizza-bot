#!/usr/bin/env bash
#
# Pre-launch reset: wipe operational/historical data, keep the catalog.
#
# Erases customers, conversations, carts, and orders accumulated during
# development and diagnostics, so the bot goes live with a clean slate.
# Preserves the menu (categories, products), delivery zones, bot config,
# admin users, and the alembic schema version.
#
# Always dumps a full Postgres backup first via scripts/backup.sh, so the
# wipe is recoverable from $BACKUP_DIR if something was discarded that
# should not have been.
#
# Usage on the VPS:
#   cd /opt/pizzabot
#   ./scripts/reset_for_launch.sh --yes
#
# Without --yes it dry-runs: prints the row counts that would be erased
# and exits 0 without touching the database.
#
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$PROJECT_DIR"

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $PROJECT_DIR" >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a; . ./.env; set +a

CONFIRM="${1:-}"

WIPE_TABLES=(
  conversation_messages
  conversations
  customer_carts
  customer_accounts
  order_status_history
  order_items
  orders
  customers
)

KEEP_TABLES=(
  categories
  products
  delivery_zones
  bot_config
  users
  alembic_version
)

psql_exec() {
  docker compose exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 "$@"
}

echo "[reset] current row counts in operational tables:"
for t in "${WIPE_TABLES[@]}"; do
  count=$(psql_exec -tA -c "SELECT COUNT(*) FROM ${t};" 2>/dev/null || echo "?")
  printf "  %-25s %s\n" "$t" "$count"
done

echo
echo "[reset] tables that will be PRESERVED:"
for t in "${KEEP_TABLES[@]}"; do
  count=$(psql_exec -tA -c "SELECT COUNT(*) FROM ${t};" 2>/dev/null || echo "?")
  printf "  %-25s %s\n" "$t" "$count"
done

if [ "$CONFIRM" != "--yes" ]; then
  echo
  echo "[reset] dry-run only. Re-run with --yes to actually wipe."
  exit 0
fi

echo
echo "[reset] backing up first..."
"${PROJECT_DIR}/scripts/backup.sh"

echo
echo "[reset] truncating operational tables..."
JOINED=$(IFS=,; echo "${WIPE_TABLES[*]}")
psql_exec -c "TRUNCATE TABLE ${JOINED} RESTART IDENTITY CASCADE;"

echo
echo "[reset] post-wipe counts:"
for t in "${WIPE_TABLES[@]}"; do
  count=$(psql_exec -tA -c "SELECT COUNT(*) FROM ${t};")
  printf "  %-25s %s\n" "$t" "$count"
done

echo
echo "[reset] done. Bot is ready for real traffic."
