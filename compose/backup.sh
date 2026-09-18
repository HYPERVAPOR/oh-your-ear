#!/usr/bin/env bash
# Dumps the production database into ./backups and prunes old copies.
#
#   ./compose/backup.sh              # keep the 14 most recent dumps
#   KEEP=30 ./compose/backup.sh
#
# Restore with:
#   podman exec -i oh-your-ear-db-1 psql -U postgres -d ohyourear < backups/<file>.sql
#
# Cron example (daily at 04:00):
#   0 4 * * * cd /srv/oh-your-ear && ./compose/backup.sh >> /var/log/oye-backup.log 2>&1
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$COMPOSE_DIR/../backups}"
KEEP="${KEEP:-14}"
DB_CONTAINER="${DB_CONTAINER:-oh-your-ear-db-1}"
STAMP="$(date +%Y-%m-%d-%H%M%S)"
OUT="$BACKUP_DIR/ohyourear-$STAMP.sql"

mkdir -p "$BACKUP_DIR"

if ! podman container exists "$DB_CONTAINER"; then
  echo "database container $DB_CONTAINER not found" >&2
  exit 1
fi

# Write to a temporary name first, so a failed dump never looks like a good one.
podman exec "$DB_CONTAINER" pg_dump -U postgres -d ohyourear > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
echo "backup written: $OUT ($(du -h "$OUT" | cut -f1))"

# Newest first, drop everything past KEEP.
mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/ohyourear-*.sql 2>/dev/null | tail -n +$((KEEP + 1)))
if (( ${#OLD[@]} > 0 )); then
  rm -f "${OLD[@]}"
  echo "pruned ${#OLD[@]} old backup(s), keeping $KEEP"
fi
