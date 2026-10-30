#!/bin/bash
# Shared by deploy.sh and rollback.sh on the EC2 instance.
set -euo pipefail

APP_DIR=/opt/fault-register
UPSTREAM=/etc/nginx/conf.d/fault-register-upstream.conf
# Nginx and systemd files come from the release that runs this script, so a
# rollback to an older release still uses the current two-slot layout.
SELF=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# The API runs in one of two slots, ports 8000 and 8001. Before the first
# two-slot deploy the single service listened on 8000.
live_port() {
  local port
  port=$(sed -n 's/.*127\.0\.0\.1:\([0-9]*\).*/\1/p' "$UPSTREAM" 2>/dev/null | head -n 1)
  echo "${port:-8000}"
}

install_platform() {
  [ -f "$UPSTREAM" ] || write_upstream "$(live_port)"
  cp "$SELF/infra/nginx/nginx.conf" /etc/nginx/nginx.conf
  cp "$SELF/infra/nginx/fault-register.conf" /etc/nginx/conf.d/fault-register.conf
  cp "$SELF"/infra/systemd/fault-register@.service "$SELF"/infra/systemd/fault-register-health.* /etc/systemd/system/
  systemctl daemon-reload
}

write_upstream() {
  printf 'upstream fault_register_api {\n    server 127.0.0.1:%s;\n}\n' "$1" > "$UPSTREAM"
}

# Waits up to 60 seconds for the slot's own /api/health to report the
# expected release with a working database connection.
slot_healthy() {
  local port=$1 expected=$2
  for _ in $(seq 1 30); do
    if curl -fsS -m 3 "http://127.0.0.1:$port/api/health" | grep -q "\"release\":\"$expected\""; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# Starts a release in the idle slot and moves Nginx to it only after it is
# healthy, so users keep the live release while the new one starts. Nginx
# reloads gracefully, which finishes requests already in flight.
release_to() {
  local dir=$1 id=$2 live idle
  live=$(live_port)
  idle=$([ "$live" = 8001 ] && echo 8000 || echo 8001)
  install_platform
  echo "== Start $id on port $idle while port $live keeps serving"
  ln -sfn "$dir" "$APP_DIR/slot-$idle"
  systemctl restart "fault-register@$idle"
  if ! slot_healthy "$idle" "$id"; then
    echo "== Health check failed for $id; users stay on port $live"
    systemctl stop "fault-register@$idle" || true
    return 1
  fi
  write_upstream "$idle"
  nginx -t
  ln -sfn "$dir" "$APP_DIR/current"
  systemctl reload-or-restart nginx
  # Enabled so the live slot comes back by itself when the lab restarts the instance.
  systemctl enable "fault-register@$idle" nginx
  systemctl enable --now fault-register-health.timer
  systemctl disable --now "fault-register@$live" 2>/dev/null || true
  if [ -f /etc/systemd/system/fault-register.service ]; then
    systemctl disable --now fault-register.service || true
    rm -f /etc/systemd/system/fault-register.service
    systemctl daemon-reload
  fi
  echo "== $id now serves on port $idle"
}
