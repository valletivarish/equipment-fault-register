#!/bin/bash
# Post-deploy check through the public origin: smoke-test.sh <base-url> <expected-release>
# Exercises Nginx, FastAPI and RDS with one throwaway record, which is always deleted again.
set -euo pipefail
BASE=${1%/}
RELEASE=$2
fail() { echo "FAIL: $1"; exit 1; }

curl -fsS "$BASE/api/health" | jq -e --arg r "$RELEASE" '.status == "ok" and .release == $r' > /dev/null \
  || fail "health check does not report release $RELEASE"
echo "ok   health reports release $RELEASE"

for path in / /faults/1; do
  curl -fsS "$BASE$path" | grep -q '<div id="root">' || fail "page $path is not the React app"
done
echo "ok   React app served at / and on a deep link"

TAG="SMOKE-$(date +%s)"
ID=$(curl -fsS -X POST "$BASE/api/faults" -H 'Content-Type: application/json' \
  -d "{\"asset_tag\":\"$TAG\",\"equipment_name\":\"Smoke test\",\"location\":\"Pipeline\",\"fault_description\":\"Created by the CD smoke test\",\"reported_date\":\"$(date -u +%F)\"}" | jq -r .id)
# The record is removed even if a later check fails.
trap 'curl -s -o /dev/null -X DELETE "$BASE/api/faults/$ID"' EXIT
echo "ok   created fault $ID"

curl -fsS "$BASE/api/faults/$ID" | jq -e --arg t "$TAG" '.asset_tag == $t' > /dev/null || fail "read back"
curl -fsS -X PUT "$BASE/api/faults/$ID" -H 'Content-Type: application/json' \
  -d "{\"asset_tag\":\"$TAG\",\"equipment_name\":\"Smoke test\",\"location\":\"Pipeline\",\"fault_description\":\"Updated by the CD smoke test\",\"reported_date\":\"$(date -u +%F)\",\"repair_status\":\"Fixed\"}" \
  | jq -e '.repair_status == "Fixed"' > /dev/null || fail "update"
echo "ok   read and updated fault $ID"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/faults" -H 'Content-Type: application/json' -d '{"asset_tag":"bad tag!"}')
[ "$code" = 422 ] || fail "invalid input returned $code instead of 422"
echo "ok   invalid input rejected with 422"

[ "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/api/faults/$ID")" = 204 ] || fail "delete"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/faults/$ID")" = 404 ] || fail "deleted record still found"
trap - EXIT
echo "ok   deleted fault $ID and confirmed it is gone"
