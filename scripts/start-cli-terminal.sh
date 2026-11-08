#!/usr/bin/env bash
set -euo pipefail
# Browser terminal runs in the Codespace environment, never on the host kernel.
if ! command -v ttyd >/dev/null 2>&1; then
  echo "ttyd missing. Install with: sudo apt-get update && sudo apt-get install -y ttyd" >&2
  exit 1
fi
PORT="${CLI_PORT:-7681}"
echo "AI Linux CLI: open Codespaces forwarded port ${PORT} (keep port visibility Private)"
exec ttyd --writable --interface 127.0.0.1 --port "$PORT" --client-option 'fontSize=15' bash -l
