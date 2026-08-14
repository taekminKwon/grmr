#!/usr/bin/env bash
# Local Docker Compose deployment for this repository.
# Usage: scripts/deploy-local.sh [path/to/env-file]
#   Defaults to "<repo-root>/.env" when no argument is given.
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"

REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)" || {
  echo "error: could not resolve repository root from $SCRIPT_DIR (not inside a git work tree)" >&2
  exit 1
}

COMPOSE_FILE="$REPO_ROOT/compose.yaml"
ENV_FILE="${1:-$REPO_ROOT/.env}"
PROJECT_NAME="infra-compose"
WAIT_TIMEOUT="${DEPLOY_LOCAL_WAIT_TIMEOUT:-180}"

if ! command -v docker >/dev/null 2>&1; then
  echo "error: docker is not installed or not on PATH" >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "error: 'docker compose' plugin is not available" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "error: docker daemon is not running or not reachable" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "error: compose file not found at $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "error: env file not found at $ENV_FILE" >&2
  exit 1
fi

BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
COMMIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo "Deploying branch '$BRANCH' at commit '$COMMIT'"
echo "Repo root : $REPO_ROOT"
echo "Compose   : $COMPOSE_FILE"
echo "Env file  : $ENV_FILE"
echo "Project   : $PROJECT_NAME"

compose() {
  docker compose \
    -p "$PROJECT_NAME" \
    -f "$COMPOSE_FILE" \
    --env-file "$ENV_FILE" \
    "$@"
}

deploy_status=0
compose up --build -d --remove-orphans --wait --wait-timeout "$WAIT_TIMEOUT" || deploy_status=$?

echo
echo "=== docker compose ps ($PROJECT_NAME) ==="
compose ps || true

exit "$deploy_status"
