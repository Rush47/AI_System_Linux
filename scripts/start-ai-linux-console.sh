#!/usr/bin/env bash
set -euo pipefail
# Start the AI Linux NLP backend and GUI in one Codespaces session.
# The backend remains a non-root process; sudo is available in the separate
# Codespaces terminal if the current user is permitted to use it.
cd "$(dirname "$0")/.."
command -v node >/dev/null || { echo "Node.js required"; exit 1; }
command -v npm >/dev/null || { echo "npm required"; exit 1; }
if [[ ! -d gui/node_modules ]]; then (cd gui && npm ci); fi
echo "Starting private NLP backend (port 8765)..."
bash scripts/start-nlp-cli.sh &
backend_pid=$!
cleanup(){ kill "$backend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
for i in $(seq 1 30); do
  if curl --silent --fail http://127.0.0.1:8765/health >/dev/null; then break; fi
  if ! kill -0 "$backend_pid" 2>/dev/null; then echo "Backend exited; check output above"; exit 1; fi
  sleep 1
done
if ! curl --silent --fail http://127.0.0.1:8765/health >/dev/null; then echo "Backend not ready"; exit 1; fi
echo "GUI: Codespaces forwarded port 5173 (Private)."
echo "NLP token: cat ~/.local/state/ai-linux/nlp-cli-token"
echo "Root check (separate Codespaces terminal): sudo -n id"
cd gui
npm run dev
