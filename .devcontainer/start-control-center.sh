#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
load_mcp_token() {
  local variable_name="$1"
  local token_file="$2"
  local token_value=""
  if [[ -n "${!variable_name:-}" ]]; then
    return
  fi
  if [[ ! -s "$token_file" ]]; then
    umask 077
    openssl rand -hex 32 > "$token_file"
  fi
  chmod 600 "$token_file"
  IFS= read -r token_value < "$token_file"
  if [[ ! "$token_value" =~ ^[a-f0-9]{64}$ ]]; then
    printf 'Invalid MCP token file: %s\n' "$token_file" >&2
    exit 1
  fi
  export "$variable_name=$token_value"
}
load_mcp_token MCP_AUTH_TOKEN .mcp-auth-token
load_mcp_token MCP_TERMINAL_TOKEN .mcp-terminal-token
if [[ -z "${MCP_PUBLIC_BASE_URL:-}" ]]; then
  if [[ -n "${CODESPACE_NAME:-}" ]]; then
    export MCP_PUBLIC_BASE_URL="https://${CODESPACE_NAME}-3082.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  else
    export MCP_PUBLIC_BASE_URL="http://127.0.0.1:3082"
  fi
fi
mkdir -p /tmp/ai-linux
if curl -fsS --max-time 2 http://127.0.0.1:3081/health >/dev/null 2>&1; then
  echo "AI Linux Control Center already running on port 3081"
else
  nohup node deploy/control-center/server.mjs >>/tmp/ai-linux/control-center.log 2>&1 </dev/null &
  pid=$!
  for _ in {1..20}; do
    if curl -fsS --max-time 1 http://127.0.0.1:3081/health >/dev/null 2>&1; then
      echo "AI Linux Control Center started (PID $pid) on port 3081"
      break
    fi
    sleep 0.5
  done
  if ! curl -fsS --max-time 2 http://127.0.0.1:3081/health >/dev/null 2>&1; then
    echo "AI Linux Control Center failed to become healthy" >&2
    tail -40 /tmp/ai-linux/control-center.log >&2
    exit 1
  fi
fi
if curl -fsS --max-time 2 http://127.0.0.1:3082/health >/dev/null 2>&1; then
  echo "OAuth MCP gateway already running on port 3082"
else
  nohup node deploy/control-center/oauth-mcp-gateway.mjs >>/tmp/ai-linux/mcp-gateway.log 2>&1 </dev/null &
  gateway_pid=$!
  for _ in {1..20}; do
    if curl -fsS --max-time 1 http://127.0.0.1:3082/health >/dev/null 2>&1; then
      echo "OAuth MCP gateway started (PID $gateway_pid) on port 3082"
      break
    fi
    sleep 0.5
  done
  if ! curl -fsS --max-time 2 http://127.0.0.1:3082/health >/dev/null 2>&1; then
    echo "OAuth MCP gateway failed to become healthy" >&2
    tail -40 /tmp/ai-linux/mcp-gateway.log >&2
    exit 1
  fi
fi
echo "Control Center: http://127.0.0.1:3081"
echo "OAuth MCP: $MCP_PUBLIC_BASE_URL/mcp"
