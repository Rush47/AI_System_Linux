"""Independent AI Linux REST task service (no MCP, no Bastilla dependency).

Persistent SQLite queue and worker; agent names are routing labels, NOT verified
original agent identities. Ollama executes tasks; no shell or root execution.
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen

AGENTS = ("Aria", "Alex", "Astyria", "Aurelius")
OLLAMA = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
MODEL = os.getenv("AGENT_MODEL", "thox-ai/thoxopen-8b-heretic:q4_k_m")
TOKEN = os.getenv("AGENT_API_TOKEN", "")
PORT = int(os.getenv("AGENT_API_PORT", "8091"))
DB_PATH = os.getenv("AGENT_DB_PATH", "/data/agent_tasks.sqlite3")
LOCK = threading.Lock()


def now():
    return datetime.now(timezone.utc).isoformat()


def connect():
    db = sqlite3.connect(DB_PATH, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA busy_timeout=30000")
    return db


def init_db():
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY, agent TEXT NOT NULL, description TEXT NOT NULL,
            status TEXT NOT NULL, createdAt TEXT NOT NULL,
            startedAt TEXT, completedAt TEXT, result TEXT, error TEXT)""")
        # A worker killed by a restart leaves its task pending, not 'completed'.
        db.execute("UPDATE tasks SET status='queued', startedAt=NULL WHERE status='running'")


def row_to_dict(row):
    return dict(row) if row else None


def next_task():
    with LOCK:
        with connect() as db:
            row = db.execute("SELECT * FROM tasks WHERE status='queued' ORDER BY createdAt, id LIMIT 1").fetchone()
            if not row:
                return None
            db.execute("UPDATE tasks SET status='running', startedAt=? WHERE id=?", (now(), row["id"]))
            return dict(row)


def finish(task_id, status, result=None, error=None):
    with connect() as db:
        db.execute("UPDATE tasks SET status=?, result=?, error=?, completedAt=? WHERE id=?",
                   (status, result, error, now(), task_id))


def worker():
    while True:
        try:
            task = next_task()
            if not task:
                time.sleep(1)
                continue
            try:
                payload = json.dumps({"model": MODEL, "stream": False,
                    "messages": [
                        {"role": "system", "content": "You are a local AI task executor. Never claim to be a verified external agent. Do not execute commands."},
                        {"role": "user", "content": f"Task label {task['agent']}: {task['description']}"}
                    ]}).encode()
                req = Request(f"{OLLAMA}/api/chat", data=payload, headers={"Content-Type": "application/json"})
                with urlopen(req, timeout=360) as response:
                    result = json.load(response).get("message", {}).get("content", "")
                if not isinstance(result, str) or not result.strip():
                    raise ValueError("Empty Ollama response")
                finish(task["id"], "completed", result=result)
            except Exception as exc:
                finish(task["id"], "failed", error=str(exc))
        except Exception as exc:
            print(f"worker error: {exc}", flush=True)
            time.sleep(3)


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        return bool(TOKEN) and self.headers.get("Authorization") == f"Bearer {TOKEN}"

    def do_GET(self):
        if not self.authorized():
            return self.send_json(401, {"error": "unauthorized"})
        if self.path == "/health":
            return self.send_json(200, {"service": "ai-linux-agent-rest",
                "agentIdentityVerified": False, "model": MODEL, "persistentQueue": True})
        if self.path == "/agents":
            return self.send_json(200, {"agents": [
                {"name": name, "identityVerified": False, "executor": "ollama"}
                for name in AGENTS]})
        if self.path == "/tasks":
            with connect() as db:
                rows = db.execute("SELECT * FROM tasks ORDER BY createdAt DESC LIMIT 100").fetchall()
            return self.send_json(200, {"tasks": [row_to_dict(row) for row in rows]})
        if self.path.startswith("/tasks/"):
            task_id = self.path.removeprefix("/tasks/")
            with connect() as db:
                task = row_to_dict(db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone())
            return self.send_json(200 if task else 404, task or {"error": "not found"})
        return self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if not self.authorized():
            return self.send_json(401, {"error": "unauthorized"})
        if self.path != "/tasks":
            return self.send_json(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536:
                return self.send_json(413, {"error": "invalid payload size"})
            data = json.loads(self.rfile.read(length))
            agent, description = data.get("agent"), data.get("description")
            if agent not in AGENTS or not isinstance(description, str) or not 0 < len(description) <= 16000:
                return self.send_json(400, {"error": "invalid agent or description"})
        except (ValueError, TypeError, AttributeError):
            return self.send_json(400, {"error": "invalid JSON"})
        task_id = str(uuid.uuid4())
        task = {"id": task_id, "agent": agent, "description": description,
                "status": "queued", "createdAt": now()}
        with connect() as db:
            db.execute("INSERT INTO tasks (id,agent,description,status,createdAt) VALUES (?,?,?,?,?)",
                       (task_id, agent, description, "queued", task["createdAt"]))
        self.send_json(202, task)


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("Set AGENT_API_TOKEN in environment")
    init_db()
    threading.Thread(target=worker, daemon=True, name="agent-worker").start()
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
