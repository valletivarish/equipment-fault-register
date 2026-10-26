#!/bin/bash
# Manual recovery on EC2 (through SSM): rollback.sh [release-id]
# Without an argument it returns to the last release that passed its health
# check before the current one. The database is not rolled back; migrations are kept backwards compatible.
set -euo pipefail
source "$(dirname "$0")/release-lib.sh"

CURRENT=$(basename "$(readlink -f "$APP_DIR/current")")
if [ $# -ge 1 ]; then
  TARGET=$1
else
  TARGET=$(tac "$APP_DIR/healthy-releases" | grep -vx "$CURRENT" | head -n 1)
fi
[ -d "$APP_DIR/releases/$TARGET" ] || { echo "Release $TARGET not found"; exit 1; }

echo "== Rolling back from $CURRENT to $TARGET"
activate_release "$APP_DIR/releases/$TARGET"
wait_until_healthy "$TARGET" && echo "== $TARGET is healthy"
