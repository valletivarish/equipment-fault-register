#!/bin/bash
# Runs on EC2 through SSM Run Command, from inside the unpacked release bundle:
#   deploy.sh <release-id>
# Installs the release beside the running one, migrates the database, switches
# over and restores the previous release automatically if the health check fails.
set -euo pipefail
source "$(dirname "$0")/release-lib.sh"

RELEASE_ID=$1
NEW="$APP_DIR/releases/$RELEASE_ID"
PREVIOUS=$(readlink -f "$APP_DIR/current" || true)

TOKEN=$(curl -fsS -X PUT http://169.254.169.254/latest/api/token \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
REGION=$(curl -fsS -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/region)

param() {
  aws ssm get-parameter --region "$REGION" --name "$1" --with-decryption \
    --query Parameter.Value --output text
}
DB_HOST=$(param /fault-register/db/host)
MASTER_PASSWORD=$(param /fault-register/db/master-password)
APP_PASSWORD=$(param /fault-register/db/app-password)

echo "== Ensure limited application database role"
# The API connects as faults_app, which can use the faults schema but is not
# the RDS master user. Safe to run on every deploy.
PGPASSWORD="$MASTER_PASSWORD" psql -v ON_ERROR_STOP=1 -v app_pw="$APP_PASSWORD" \
  "host=$DB_HOST dbname=faults user=faultadmin sslmode=require" <<'SQL'
SELECT 'CREATE ROLE faults_app LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'faults_app') \gexec
ALTER ROLE faults_app PASSWORD :'app_pw';
GRANT CONNECT ON DATABASE faults TO faults_app;
GRANT USAGE, CREATE ON SCHEMA public TO faults_app;
SQL

echo "== Python environment"
# Virtualenvs are keyed by the requirements hash, so a release that does not
# change dependencies reuses the existing one instead of downloading again.
PYTHON=$(command -v python3.12 || command -v python3.11)
REQ_HASH=$(sha256sum "$NEW/backend/requirements.txt" | cut -c1-12)
VENV="$APP_DIR/venvs/$REQ_HASH"
if [ ! -x "$VENV/bin/uvicorn" ]; then
  "$PYTHON" -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --no-cache-dir -r "$NEW/backend/requirements.txt"
fi
ln -sfn "$VENV" "$NEW/venv"

umask 077
printf 'DATABASE_URL=postgresql+psycopg://faults_app:%s@%s:5432/faults?sslmode=require\n' \
  "$APP_PASSWORD" "$DB_HOST" > /etc/fault-register.env
umask 022
chmod -R a+rX "$NEW"

echo "== Database migrations"
(cd "$NEW/backend" && set -a && source /etc/fault-register.env && set +a \
  && "$NEW/venv/bin/alembic" upgrade head)

echo "== Switch to $RELEASE_ID"
activate_release "$NEW"

if wait_until_healthy "$RELEASE_ID"; then
  echo "== Release $RELEASE_ID is healthy"
  echo "$RELEASE_ID" >> "$APP_DIR/healthy-releases"
else
  echo "== Health check failed for $RELEASE_ID"
  if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$NEW" ]; then
    echo "== Rolling back to $(basename "$PREVIOUS")"
    activate_release "$PREVIOUS"
    wait_until_healthy "$(basename "$PREVIOUS")" && echo "== Previous release restored"
  fi
  exit 1
fi

# Keep the five newest releases for rollback and remove virtualenvs that no
# release uses any more, so the 8 GB disk does not fill over the semester.
ls -1dt "$APP_DIR"/releases/*/ | tail -n +6 | xargs -r rm -rf
for venv in "$APP_DIR"/venvs/*; do
  if ! find "$APP_DIR/releases" -maxdepth 2 -name venv -lname "$venv" | grep -q .; then
    rm -rf "$venv"
  fi
done
