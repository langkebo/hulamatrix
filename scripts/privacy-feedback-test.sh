#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://matrix.cjystx.top}"
TOKEN="${TOKEN:-}"
USER="${USER:-}"
TARGET_USER="${TARGET_USER:-@rere:cjystx.top}"
TARGET_ROOM="${TARGET_ROOM:-!roomid:domain}"

auth() { if [ -n "$TOKEN" ]; then echo "Authorization: Bearer $TOKEN"; fi; }
hdr() { echo "[$(date +%T)] $*"; }

hdr "report user"
curl -sS -X POST -H "Content-Type: application/json" -H "$(auth)" \
  -d "{\"action\":\"report_user\",\"target_id\":\"${TARGET_USER}\",\"reason\":\"spam\"}" \
  "${BASE}/_synapse/client/privacy" | jq -r .

hdr "block user"
curl -sS -X POST -H "Content-Type: application/json" -H "$(auth)" \
  -d "{\"action\":\"block_user\",\"target_id\":\"${TARGET_USER}\"}" \
  "${BASE}/_synapse/client/privacy" | jq -r .

hdr "unblock user"
curl -sS -X POST -H "Content-Type: application/json" -H "$(auth)" \
  -d "{\"action\":\"unblock_user\",\"target_id\":\"${TARGET_USER}\"}" \
  "${BASE}/_synapse/client/privacy" | jq -r .

hdr "submit feedback"
curl -sS -X POST -H "Content-Type: application/json" -H "$(auth)" \
  -d "{\"subject\":\"app issue\",\"content\":\"example feedback\"}" \
  "${BASE}/_synapse/client/feedback" | jq -r .

hdr "submit feedback with file"
touch /tmp/feedback.txt
echo "demo attachment" > /tmp/feedback.txt
curl -sS -X POST -H "$(auth)" \
  -F "subject=app issue" -F "content=example feedback" -F "file=@/tmp/feedback.txt" \
  "${BASE}/_synapse/client/feedback" | jq -r .
