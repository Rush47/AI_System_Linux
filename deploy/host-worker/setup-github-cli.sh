#!/usr/bin/env bash
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Run with sudo/root" >&2; exit 1; fi
export DEBIAN_FRONTEND=noninteractive
if ! command -v gh >/dev/null 2>&1; then apt-get update; apt-get install -y gh; fi
for agent in system-ai aria alex astyria aurelius; do
  user="ai-$agent"
  if ! id "$user" >/dev/null 2>&1; then useradd --system --create-home --shell /usr/sbin/nologin "$user"; fi
  home="$(getent passwd "$user" | cut -d: -f6)"
  install -d -m 0700 -o "$user" -g "$user" "$home/.config/gh"
  printf 'Prepared isolated gh config for %s at %s\n' "$agent" "$home/.config/gh"
done
gh --version
cat <<'EOF'
Authorize each original agent with its own GitHub account or GitHub App.
Do not store tokens in source code or chat.
Interactive admin-controlled example:
  sudo -u ai-aria -H gh auth login --web
Verify:
  sudo -u ai-aria -H gh auth status
Permissions must be granted separately on GitHub.
EOF
