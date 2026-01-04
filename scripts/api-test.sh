#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://matrix.cjystx.top}"
TOKEN="${TOKEN:-}"
USER="${USER:-}"
QUERY="${QUERY:-rere}"
TARGET="${TARGET:-@rere:matrix.cjystx.top}"

ts() { date +"%Y-%m-%d %H:%M:%S"; }
hdr() { echo "[$(ts)] $*"; }
auth() { if [ -n "$TOKEN" ]; then echo "Authorization: Bearer $TOKEN"; fi; }

hdr "well-known discovery"
curl -sS "${BASE}/.well-known/matrix/client" | jq -r .

hdr "matrix sync (short timeout)"
curl -sS -H "$(auth)" "${BASE}/_matrix/client/v3/sync?timeout=1000" | jq -r '.next_batch // "ok"'

hdr "synapse friends list"
curl -sS -H "$(auth)" "${BASE}/_synapse/client/friends?action=list&user_id=${USER}" | jq -r .

hdr "synapse friends pending_requests"
curl -sS -H "$(auth)" "${BASE}/_synapse/client/friends?action=pending_requests&user_id=${USER}" | jq -r .

hdr "synapse friends search"
curl -sS "${BASE}/_synapse/client/friends?action=search&query=${QUERY}" | jq -r .

hdr "synapse friends stats"
curl -sS -H "$(auth)" "${BASE}/_synapse/client/friends?action=stats&user_id=${USER}" | jq -r .

hdr "send friend request"
curl -sS -X POST -H "Content-Type: application/json" -H "$(auth)" \
  -d "{\"action\":\"request\",\"requester_id\":\"${USER}\",\"target_id\":\"${TARGET}\",\"message\":\"hello\"}" \
  "${BASE}/_synapse/client/friends" | jq -r .

