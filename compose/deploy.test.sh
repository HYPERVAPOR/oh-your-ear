#!/usr/bin/env bash
#
# Exercises compose/deploy.sh without a server: podman and curl are shims on PATH, and the
# repository is a throwaway clone. The point is the part that only ever runs when something
# has already gone wrong — rolling back — which is exactly the part nobody can try by hand.
#
#   bash compose/deploy.test.sh
set -euo pipefail

SOURCE=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

git clone -q "$SOURCE" "$WORK/repo"
cd "$WORK/repo"
git -c user.email=test@example.com -c user.name=test commit -q --allow-empty -m "second commit"
mkdir -p "$WORK/bin"

cp "$SOURCE/compose/deploy.sh" compose/deploy.sh
printf 'echo "[backup] ran" >> "$SINK"\nexit 0\n' > compose/backup.sh
touch "$WORK/env"

cat > "$WORK/bin/podman" <<'SHIM'
#!/bin/sh
echo "  [podman] $*" >> "$SINK"
exit "${PODMAN_EXIT:-0}"
SHIM

# Healthy from the Nth health check onwards, so a rollback can be made to succeed or fail.
cat > "$WORK/bin/curl" <<'SHIM'
#!/bin/sh
count=$(cat "$CALLS" 2>/dev/null || echo 0)
count=$((count + 1))
echo "$count" > "$CALLS"
if [ "$count" -ge "${HEALTHY_FROM:-1}" ]; then
  echo "  [health] check $count: ok" >> "$SINK"
  exit 0
fi
echo "  [health] check $count: not ok" >> "$SINK"
exit 1
SHIM

chmod +x "$WORK/bin/podman" "$WORK/bin/curl"
export PATH="$WORK/bin:$PATH" SINK="$WORK/sink" CALLS="$WORK/calls"
export ENV_FILE="$WORK/env" HEALTH_RETRIES=1

TARGET=$(git rev-parse --short HEAD)
fail=0

expect() {
  local what=$1 want_code=$2 want_head=$3
  local code=0
  bash compose/deploy.sh >"$WORK/out" 2>&1 || code=$?
  local head
  head=$(git rev-parse --short HEAD)
  if [ "$code" != "$want_code" ] || [ "$head" != "$want_head" ]; then
    echo "FAIL: $what — exit $code (want $want_code), HEAD $head (want $want_head)"
    sed 's/^/    /' "$WORK/out"
    fail=1
  else
    echo "ok: $what"
  fi
}

reset() {
  : > "$SINK"
  rm -f "$CALLS"
  git checkout --quiet "$TARGET"
}

reset; HEALTHY_FROM=1 expect "a healthy deploy keeps the new commit" 0 "$TARGET"
reset; HEALTHY_FROM=2 expect "an unhealthy deploy rolls back" 1 "$(git rev-parse --short HEAD~1)"
reset; HEALTHY_FROM=99 expect "an unhealthy rollback is reported" 1 "$(git rev-parse --short HEAD~1)"

# The database is dumped before the schema is touched: db.Migrate runs on boot, and "should be
# additive" is not a reason to have no dump.
reset; HEALTHY_FROM=1
bash compose/deploy.sh >/dev/null 2>&1 || true
if grep -q '\[backup\] ran' "$SINK"; then echo "ok: the database is backed up first"; else echo "FAIL: no backup before the deploy"; fail=1; fi

exit "$fail"
