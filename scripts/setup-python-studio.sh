#!/usr/bin/env bash
set -euo pipefail
# Run locally in Codespaces/Ubuntu. sudo only for installation, never expose a root web API.
if ! command -v sudo >/dev/null; then echo "sudo is required for system package installation" >&2; exit 1; fi
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip ttyd
mkdir -p "${HOME}/ai-linux/scripts" "${HOME}/ai-linux/logs"
python3 -m venv "${HOME}/ai-linux/.venv"
echo "Python Studio dependencies installed."
echo "Root shell (inside this Linux environment only): sudo -i"
echo "For browser root shell: DO NOT expose a privileged ttyd endpoint; use Codespaces terminal with sudo -i."
echo "Start AI Linux GUI with NLP_CLI_TOKEN set: bash scripts/start-ai-linux-gui.sh"
echo "Python Studio executes as the GUI backend user, NOT as root."
