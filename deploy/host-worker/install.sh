#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then echo "Run as root: sudo bash $0" >&2; exit 1; fi
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$SOURCE_DIR/host-worker.py" && -f "$SOURCE_DIR/ai-linux-host-worker.service" ]] || { echo "Missing worker files" >&2; exit 1; }
id -u ai-linux >/dev/null 2>&1 || useradd --system --home-dir /var/lib/ai-linux --shell /usr/sbin/nologin ai-linux
install -d -m 0750 -o root -g ai-linux /etc/ai-linux
install -d -m 0755 /opt/ai-linux
install -m 0644 "$SOURCE_DIR/host-worker.py" /opt/ai-linux/host-worker.py
install -m 0644 "$SOURCE_DIR/ai-linux-host-worker.service" /etc/systemd/system/ai-linux-host-worker.service
if [[ ! -f /etc/ai-linux/worker.env ]]; then
  TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
  printf 'AI_LINUX_WORKER_TOKEN=%s\nAI_LINUX_WORKER_PORT=8765\n' "$TOKEN" >/etc/ai-linux/worker.env
  chown root:ai-linux /etc/ai-linux/worker.env
  chmod 0640 /etc/ai-linux/worker.env
fi
systemctl daemon-reload
systemctl enable --now ai-linux-host-worker.service
systemctl --no-pager status ai-linux-host-worker.service
echo "Host worker bound to 127.0.0.1:8765; credential stored in /etc/ai-linux/worker.env"
