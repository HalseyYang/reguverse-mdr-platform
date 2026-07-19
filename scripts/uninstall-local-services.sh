#!/usr/bin/env bash
set -euo pipefail

LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
API_LABEL="com.reguverse.local.api"
WEB_LABEL="com.reguverse.local.web"

launchctl bootout "gui/$(id -u)/$API_LABEL" >/dev/null 2>&1 || true
launchctl bootout "gui/$(id -u)/$WEB_LABEL" >/dev/null 2>&1 || true

rm -f "$LAUNCH_AGENTS_DIR/$API_LABEL.plist"
rm -f "$LAUNCH_AGENTS_DIR/$WEB_LABEL.plist"

echo "Reguverse local services uninstalled."
