# AI Linux CLI: Codespaces shell and kernel operations

This is a real browser terminal backed by a bash process in the **Codespace**, not a simulated terminal.

## Run
```bash
sudo apt-get update && sudo apt-get install -y ttyd
bash scripts/start-cli-terminal.sh
```
Open the **Private** forwarded port 7681 in Codespaces. The terminal runs as the current Codespaces user. Use `sudo -i` for root **inside the Codespace** if sudo is available.

## Kernel
`uname -a`, `lsmod`, `cat /proc/version`, and `sysctl -a` inspect the live environment. Codespaces shares a kernel with its host; it does **not** grant control of the host kernel, bootloader, or unrestricted kernel module loading. To compile, modify and boot a custom Linux kernel, use a dedicated Ubuntu VM or machine with appropriate privileges. Do not run host-kernel modifications from this web terminal.

## Security
The ttyd process listens on loopback; keep the forwarded port private, do not expose it publicly, and stop it when unused. MCP and terminal are separate services. Do not grant a remote AI unrestricted root execution; use explicit review for privileged commands.
