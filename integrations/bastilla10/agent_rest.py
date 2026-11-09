"""REST bridge for Bastilla_10 agent tasks. No MCP; no invented agent identities.

Uses Ollama as a task executor. Names are routing labels until original
agent endpoints/credentials have been verified and connected.
"""
import json
import os
import threading
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

AGENTS = ("Aria", "Alex", "Astyria", "Aurelius")
TASKS = {}
LOCK = threading.Lock()
OLLAMA = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434").rstrip("/")
MODEL = os.getenv("AGENT_MODEL", "thox-ai/thoxopen-8b-heretic:q4_k_m")
TOKEN = os.getenv("AGENT_API_TOKEN", "")
PORT = int(os.getenv("AGENT_API_PORT", "8091"))


def now():
    return datetime.now(timezone.utc).isoformat()


def execute(task_id):
    with LOCK:
        task = TASKS[task_id]
        task["status"] = "running"
        task["startedAt"] = now()
        agent, description = task["agent"], task["description"]
    try:
        payload = json.dumps({"model": MODEL, "stream": False,
            "messages": [{"role": "system", "content": "You are an AI task executor. Respond accurately; do not claim to be a verified external agent."},
                         {"role": "user", "content": f"Task routed to {agent}: {description}"}]}).encode()
        req = Request(f"{OLLAMA}/api/chat", data=payload, headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=360) as response:
            data = json.load(response)
        result = data.get("message", {}).get("content", "")
        if not result.strip():
            raise ValueError("Empty Ollama response")
        with LOCK:
            task.update(status="completed", result=result, completedAt=now())
    except Exception as exc:
        with LOCK:
            task.update(status="failed", error=str(exc), completedAt=now())


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        return TOKEN and self.headers.get("Authorization") == f"Bearer {TOKEN}"

    def do_GET(self):
        if not self.authorized():
            return self.send_json(401, {"error": "unauthorized"})
        if self.path == "/health":
            return self.send_json(200, {"service": "bastilla-agent-rest", "agentIdentityVerified": False, "model": MODEL})
        if self.path == "/agents":
            return self.send_json(200, {"agents": [{"name": name, "identityVerified": False, "executor": "ollama"} for name in AGENTS]})
        if self.path.startswith("/tasks/"):
            with LOCK:
                task = TASKS.get(self.path.split("/")[-1])
                data = dict(task) if task else None
            return self.send_json(200 if data else 404, data or {"error": "not found"})
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
        except (ValueError, TypeError, json.JSONDecodeError):
            return self.send_json(400, {"error": "invalid JSON"})
        task_id = str(uuid.uuid4())
        task = {"id": task_id, "agent": agent, "description": description,
                "status": "queued", "createdAt": now()}
        with LOCK:
            TASKS[task_id] = task
        threading.Thread(target=execute, args=(task_id,), daemon=True).start()
        self.send_json(202, task)


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("Set AGENT_API_TOKEN in environment")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
