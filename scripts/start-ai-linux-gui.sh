#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${NLP_CLI_TOKEN:-}" ]]; then
  echo 'Set NLP_CLI_TOKEN in this shell (do not commit it).' >&2
  exit 1
fi
if ! command -v node >/dev/null; then echo 'Node.js required' >&2; exit 1; fi
echo 'Starting NLP CLI on localhost:8765 (AUTO-EXEC defaults to off unless NLP_AUTO_EXEC=true).'
node tools/ollama-cli/server.mjs &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT
cd gui
npm install
npm run dev
