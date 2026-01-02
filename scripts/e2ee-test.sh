#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-https://matrix.cjystx.top}"
TOKEN="${TOKEN:-}"
hdr() { if [ -n "$TOKEN" ]; then echo "Authorization: Bearer $TOKEN"; fi; }
echo "[devices]"
curl -sS -H "$(hdr)" "${BASE}/_matrix/client/v3/devices" | jq -r '.devices | length'
echo "[done]"
