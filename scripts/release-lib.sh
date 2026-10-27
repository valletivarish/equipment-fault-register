#!/bin/bash
# Shared by deploy.sh and rollback.sh on the EC2 instance.
set -euo pipefail

APP_DIR=/opt/fault-register

# Points "current" at a release, installs that release's Nginx and systemd
# files, restarts the API and reloads Nginx only if its config is valid.
activate_release() {
  local release_dir=$1
  cp "$release_dir/infra/nginx/nginx.conf" /etc/nginx/nginx.conf
  cp "$release_dir/infra/nginx/fault-register.conf" /etc/nginx/conf.d/fault-register.conf
  cp "$release_dir"/infra/systemd/fault-register* /etc/systemd/system/
  nginx -t
  ln -sfn "$release_dir" "$APP_DIR/current"
  systemctl daemon-reload
  # Enabled so the API comes back by itself when the lab restarts the instance.
  systemctl enable fault-register
  systemctl restart fault-register
  systemctl enable --now fault-register-health.timer
  systemctl enable nginx
  systemctl reload-or-restart nginx
}

# Waits up to 60 seconds for /api/health, through Nginx, to report the
# expected release with a working database connection.
wait_until_healthy() {
  local expected=$1
  for _ in $(seq 1 30); do
    if curl -fsS -m 3 http://127.0.0.1/api/health | grep -q "\"release\":\"$expected\""; then
      return 0
    fi
    sleep 2
  done
  return 1
}
