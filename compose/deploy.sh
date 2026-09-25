#!/usr/bin/env bash
#
# Deploy the API and database on this host. Run from the repository root, at the commit you
# want live:
#
#     cd /opt/oh-your-ear && git fetch --quiet origin && git checkout --quiet <sha> && bash compose/deploy.sh
#
# It dumps the database, rebuilds and restarts the stack, and waits for the health endpoint.
# If the new commit never becomes healthy, it puts the previous one back and rebuilds that.
# An automated deploy that cannot undo itself is a foot-gun pointed at production.
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=${ENV_FILE:-.env}
COMPOSE_FILE=${COMPOSE_FILE:-compose/compose.yml}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:8080/api/v1/health}
HEALTH_RETRIES=${HEALTH_RETRIES:-30}

if [[ ! -f $ENV_FILE ]]; then
  echo "missing $ENV_FILE: podman compose is given it explicitly here (see docs/deploy.md 4)" >&2
  exit 1
fi

TARGET=$(git rev-parse HEAD)
# On a checkout with a single commit there is nothing to go back to; say so rather than
# failing on HEAD~1 with set -e.
PREVIOUS=$(git rev-parse --quiet --verify HEAD~1 || echo "$TARGET")

compose() {
  podman compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

health() {
  for _ in $(seq "$HEALTH_RETRIES"); do
    if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Before anything touches the schema. db.Migrate is additive and idempotent, but "should be
# additive" is not a reason to have no dump.
echo "==> backing up the database"
bash compose/backup.sh

echo "==> building and starting $(git rev-parse --short "$TARGET")"
if compose up -d --build && health; then
  podman image prune -f --filter "until=168h" >/dev/null 2>&1 || true
  echo "==> deployed $(git rev-parse --short "$TARGET")"
  exit 0
fi

echo "==> $(git rev-parse --short "$TARGET") never became healthy; going back to $(git rev-parse --short "$PREVIOUS")" >&2
git checkout --quiet "$PREVIOUS"
compose up -d --build
if health; then
  echo "==> rolled back to $(git rev-parse --short "$PREVIOUS")" >&2
else
  echo "==> the rollback is unhealthy too; check 'podman logs oh-your-ear-api-1'" >&2
fi
exit 1
