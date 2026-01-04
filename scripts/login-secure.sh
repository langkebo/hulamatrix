#!/usr/bin/env bash
set -euo pipefail

# Secure login: writes token to a local file without printing to stdout
# Usage:
#   BASE=https://matrix.cjystx.top USER=rere PASS=Ljf3790791 ./scripts/login-secure.sh
# Output:
#   writes token to .hula_token and user id to .hula_user; prints "login_ok"

BASE="${BASE:-https://matrix.cjystx.top}"
USER="${USER:?set USER (e.g. rere)}"
PASS="${PASS:?set PASS}"

TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT

curl -sS -X POST "${BASE}/_matrix/client/v3/login" \
  -H 'Content-Type: application/json' \
  -d "{
    \"type\":\"m.login.password\",
    \"identifier\":{\"type\":\"m.id.user\",\"user\":\"${USER}\"},
    \"password\":\"${PASS}\",
    \"device_id\":\"api-tests\"
  }" > "$TMP_OUT"

TOKEN="$(jq -r '.access_token // empty' < "$TMP_OUT")"
USERID="$(jq -r '.user_id // empty' < "$TMP_OUT")"

if [ -z "$TOKEN" ]; then
  echo "login_failed" && exit 1
fi

echo -n "$TOKEN" > .hula_token
echo -n "$USERID" > .hula_user
echo "login_ok"

