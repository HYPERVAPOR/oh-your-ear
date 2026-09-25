#!/usr/bin/env bash
# Dumps the production database into ./backups and prunes old copies.
#
#   ./compose/backup.sh              # keep the 14 most recent dumps
#   KEEP=30 ./compose/backup.sh
#
# Restore with:
#   docker exec -i oh-your-ear-db-1 psql -U postgres -d ohyourear < backups/<file>.sql
#   (podman instead of docker on a host that uses podman — see the runtime detection below)
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

# docker or podman, whichever this host has. Hardcoding one made this script useless on the
# other: it exited before dumping anything, which deploy.sh then treated as "stop".
if command -v docker >/dev/null 2>&1; then
  RUNTIME=docker
elif command -v podman >/dev/null 2>&1; then
  RUNTIME=podman
else
  echo "neither docker nor podman is installed" >&2
  exit 1
fi

# `inspect`, not `container exists`: the latter is podman's spelling, and docker answers it
# with "unknown command". Found by running it on the host that has docker.
if ! "$RUNTIME" inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "database container $DB_CONTAINER not found" >&2
  exit 1
fi

# Write to a temporary name first, so a failed dump never looks like a good one.
"$RUNTIME" exec "$DB_CONTAINER" pg_dump -U postgres -d ohyourear > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
echo "backup written: $OUT ($(du -h "$OUT" | cut -f1))"

# Newest first, drop everything past KEEP.
mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/ohyourear-*.sql 2>/dev/null | tail -n +$((KEEP + 1)))
if (( ${#OLD[@]} > 0 )); then
  rm -f "${OLD[@]}"
  echo "pruned ${#OLD[@]} old backup(s), keeping $KEEP"
fi
