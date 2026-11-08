#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
if curl -fsS --max-time 2 http://127.0.0.1:3081/health >/dev/null 2>&1; then
  echo "AI Linux Control Center already running on port 3081"
  exit 0
fi
mkdir -p /tmp/ai-linux
nohup node deploy/control-center/server.mjs >>/tmp/ai-linux/control-center.log 2>&1 </dev/null &
pid=$!
for _ in {1..20}; do
  if curl -fsS --max-time 1 http://127.0.0.1:3081/health >/dev/null 2>&1; then
    echo "AI Linux Control Center started (PID $pid) on port 3081"
    echo "Logs: /tmp/ai-linux/control-center.log"
    exit 0
  fi
  sleep 0.5
done
echo "AI Linux Control Center failed to become healthy" >&2
tail -40 /tmp/ai-linux/control-center.log >&2
exit 1
