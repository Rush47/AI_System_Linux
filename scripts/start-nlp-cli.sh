#!/usr/bin/env bash
set -euo pipefail
# Start the private NLP console with a persistent operator token.
# The token is stored outside the Git working tree and never committed.
state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/ai-linux"
token_file="$state_dir/nlp-cli-token"
mkdir -p "$state_dir"
chmod 700 "$state_dir"
if [[ ! -s "$token_file" ]]; then
  umask 077
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32 > "$token_file"
  else
    python3 -c 'import secrets; print(secrets.token_hex(32))' > "$token_file"
  fi
fi
chmod 600 "$token_file"
export NLP_CLI_TOKEN="$(cat "$token_file")"
echo "AI Linux NLP CLI: token saved in $token_file"
echo "To authenticate the GUI, open a trusted Codespaces terminal and run:"
echo "  cat $token_file"
echo "Paste the token into the GUI's NLP_CLI_TOKEN field."
echo "The service binds to 127.0.0.1:8765. Keep the forwarded port private."
exec node tools/ollama-cli/server.mjs
