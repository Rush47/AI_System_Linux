# AI Linux Ubuntu host worker — installation

This is a **read-only diagnostic task worker**, not a root executor or AI runtime. It is intentionally installed as the unprivileged `ai-linux` service user. Only run this installer on an Ubuntu host you control, after reviewing the files.

```bash
cd deploy/host-worker
sudo bash ./install.sh
```

The installer creates a system user, installs the Python service and systemd unit, generates a random API bearer token once in `/etc/ai-linux/worker.env`, and enables the service on boot. It binds to **127.0.0.1:8765**, not to a public interface.

Example request from the Ubuntu host:

```bash
TOKEN=$(sudo sed -n 's/^AI_LINUX_WORKER_TOKEN=//p' /etc/ai-linux/worker.env)
curl -sS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"action":"system.snapshot","arguments":{}}' http://127.0.0.1:8765/tasks
```

Poll the returned task ID at `GET /tasks/<task_id>` using the same Authorization header. Also supports `system.service_state` with `{"name":"ssh.service"}`.

Inspect status with `sudo systemctl status ai-linux-host-worker` and logs with `sudo journalctl -u ai-linux-host-worker -f`. Stop with `sudo systemctl disable --now ai-linux-host-worker`.

**Not yet implemented:** panel API bridge, remote-device video, root executor, four original agents, System AI daemon, AI Studio integration, end-to-end Ubuntu tests. Never paste the bearer token into a chat or commit it to GitHub.
