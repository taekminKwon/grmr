#!/usr/bin/env bash
# Non-executing validation for deploy-local.sh: syntax check only, no Docker calls.
# Usage: scripts/check-deploy-local.sh
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
TARGET="$SCRIPT_DIR/deploy-local.sh"

bash -n "$TARGET"
echo "OK: $TARGET is syntactically valid"
