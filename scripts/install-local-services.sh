#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/hanyueyang/Documents/New project"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$PROJECT_DIR/logs"

API_LABEL="com.reguverse.local.api"
WEB_LABEL="com.reguverse.local.web"

mkdir -p "$LAUNCH_AGENTS_DIR" "$LOG_DIR"

launchctl bootout "gui/$(id -u)/$API_LABEL" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)/$WEB_LABEL" >/dev/null 2>&1 || true

sleep 1

for port in 8787 5173; do
  pids="$(lsof -ti "tcp:$port" || true)"
  for pid in $pids; do
    kill "$pid" >/dev/null 2>&1 || true
  done
done

sleep 1

cp "$PROJECT_DIR/launchd/$API_LABEL.plist" "$LAUNCH_AGENTS_DIR/$API_LABEL.plist"
cp "$PROJECT_DIR/launchd/$WEB_LABEL.plist" "$LAUNCH_AGENTS_DIR/$WEB_LABEL.plist"

launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENTS_DIR/$API_LABEL.plist"
launchctl bootstrap "gui/$(id -u)" "$LAUNCH_AGENTS_DIR/$WEB_LABEL.plist"

launchctl enable "gui/$(id -u)/$API_LABEL"
launchctl enable "gui/$(id -u)/$WEB_LABEL"
launchctl kickstart -k "gui/$(id -u)/$API_LABEL"
launchctl kickstart -k "gui/$(id -u)/$WEB_LABEL"

echo "Reguverse local services installed."
echo "Frontend: http://127.0.0.1:5173/"
echo "API:      http://127.0.0.1:8787/api/health"
