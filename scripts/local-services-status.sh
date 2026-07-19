#!/usr/bin/env bash
set -euo pipefail

API_LABEL="com.reguverse.local.api"
WEB_LABEL="com.reguverse.local.web"

echo "launchd jobs:"
launchctl print "gui/$(id -u)/$API_LABEL" >/dev/null 2>&1 && echo "  API: loaded" || echo "  API: not loaded"
launchctl print "gui/$(id -u)/$WEB_LABEL" >/dev/null 2>&1 && echo "  Web: loaded" || echo "  Web: not loaded"

echo
echo "ports:"
for attempt in 1 2 3 4 5; do
  if lsof -nP -iTCP:8787 -sTCP:LISTEN >/dev/null 2>&1 && lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

lsof -nP -iTCP:8787 -sTCP:LISTEN || true
lsof -nP -iTCP:5173 -sTCP:LISTEN || true

echo
echo "health:"
curl -s http://127.0.0.1:8787/api/health || true
echo
curl -s -o /dev/null -w "frontend:%{http_code}\n" http://127.0.0.1:5173/ || true
