#!/usr/bin/env python3
"""AI Linux host worker: persistent, local-only task queue. No model or root executor yet."""
import json
import os
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DB = Path(os.environ.get("AI_LINUX_DB", "/var/lib/ai-linux/worker.sqlite3"))
TOKEN = os.environ.get("AI_LINUX_WORKER_TOKEN", "")
PORT = int(os.environ.get("AI_LINUX_WORKER_PORT", "8765"))
ALLOWED = {"system.snapshot", "system.service_state"}
LOCK = threading.Lock()

def connect():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

def init():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with connect() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS tasks
          (id TEXT PRIMARY KEY, action TEXT NOT NULL, arguments TEXT NOT NULL,
           state TEXT NOT NULL, result TEXT, created TEXT NOT NULL, updated TEXT NOT NULL)""")
        con.execute("UPDATE tasks SET state='queued' WHERE state='running'")

def now():
    return datetime.now(timezone.utc).isoformat()

def snapshot():
    data = {"time": now(), "hostname": os.uname().nodename, "kernel": os.uname().release}
    try:
        data["loadavg"] = os.getloadavg()
        data["uptime_seconds"] = float(Path("/proc/uptime").read_text().split()[0])
    except (OSError, ValueError):
        pass
    return data

def run_task(action, args):
    if action == "system.snapshot":
        return snapshot()
    if action == "system.service_state":
        name = args.get("name", "")
        if not isinstance(name, str) or not name.endswith(".service") or "/" in name or len(name) > 100:
            raise ValueError("invalid service name")
        # Read-only service state from systemd; no shell invocation.
        import subprocess
        p = subprocess.run(["systemctl", "show", name, "--property=ActiveState,SubState,LoadState", "--no-pager"],
                           capture_output=True, text=True, timeout=8, check=False)
        return {"service": name, "exit_code": p.returncode, "output": p.stdout[:4096], "error": p.stderr[:512]}
    raise ValueError("unsupported action")

def worker():
    while True:
        with LOCK, connect() as con:
            row = con.execute("SELECT * FROM tasks WHERE state='queued' ORDER BY created LIMIT 1").fetchone()
            if row:
                con.execute("UPDATE tasks SET state='running',updated=? WHERE id=?", (now(), row["id"]))
        if not row:
            time.sleep(0.5)
            continue
        try:
            result = {"ok": True, "data": run_task(row["action"], json.loads(row["arguments"]))}
            state = "completed"
        except Exception as exc:
            result, state = {"ok": False, "error": str(exc)[:512]}, "failed"
        with LOCK, connect() as con:
            con.execute("UPDATE tasks SET state=?,result=?,updated=? WHERE id=?",
                        (state, json.dumps(result), now(), row["id"]))

class Handler(BaseHTTPRequestHandler):
    def respond(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        import hmac
        return bool(TOKEN) and hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + TOKEN)

    def do_GET(self):
        if not self.authorized():
            return self.respond(401, {"error": "unauthorized"})
        if self.path == "/health":
            return self.respond(200, {"ok": True, "service": "ai-linux-host-worker", "privileged": False})
        if self.path.startswith("/tasks/"):
            task_id = self.path.removeprefix("/tasks/")
            with LOCK, connect() as con:
                row = con.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
            return self.respond(200 if row else 404, dict(row) if row else {"error": "not found"})
        self.respond(404, {"error": "not found"})

    def do_POST(self):
        if not self.authorized():
            return self.respond(401, {"error": "unauthorized"})
        if self.path != "/tasks":
            return self.respond(404, {"error": "not found"})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size < 1 or size > 8192:
                return self.respond(413, {"error": "invalid payload size"})
            body = json.loads(self.rfile.read(size))
            action, args = body.get("action"), body.get("arguments", {})
            if action not in ALLOWED or not isinstance(args, dict):
                return self.respond(400, {"error": "unsupported action or arguments"})
            task_id = str(uuid.uuid4())
            with LOCK, connect() as con:
                con.execute("INSERT INTO tasks VALUES (?,?,?,?,?,?,?)",
                            (task_id, action, json.dumps(args), "queued", None, now(), now()))
            return self.respond(202, {"task_id": task_id, "state": "queued"})
        except (ValueError, TypeError, json.JSONDecodeError):
            return self.respond(400, {"error": "invalid JSON"})

if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("AI_LINUX_WORKER_TOKEN must be set")
    init()
    threading.Thread(target=worker, daemon=True).start()
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
