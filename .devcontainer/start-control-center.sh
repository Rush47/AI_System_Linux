#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if curl -fsS --max-time 2 http://127.0.0.1:3081/health >/dev/null 2>&1; then
  echo "AI Linux Control Center already running on port 3081"
  exit 0
fi
mkdir -p /tmp/ai-linux
nohup node deploy/control-center/server.mjs >>/tmp/ai-linux/control-center.log 2>&1 </dev/null &
echo "AI Linux Control Center started (PID $!) on port 3081"
echo "Logs: /tmp/ai-linux/control-center.log"
