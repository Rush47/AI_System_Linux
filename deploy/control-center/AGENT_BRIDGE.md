# Outbound agents bridge — AI Linux

## Current integration
When chat receives @aria, @alex, @astyria or @aurelius, the authenticated POST /api/agents/mentions creates a task and asynchronously POSTs it to each configured agent endpoint. It reports **accepted-by-endpoint** only for HTTP 2xx; this does not prove the agent performed work.

Set on the Linux backend (server-side only):
```dotenv
AGENT_DISPATCH_TOKEN=<random operator token>
AGENT_OUTBOUND_TOKEN=<random shared bridge token>
AGENT_INGEST_TOKEN=<random callback token>
ARIA_TASK_URL=https://your-agent-gateway.example/aria/tasks
ALEX_TASK_URL=https://your-agent-gateway.example/alex/tasks
ASTYRIA_TASK_URL=https://your-agent-gateway.example/astyria/tasks
AURELIUS_TASK_URL=https://your-agent-gateway.example/aurelius/tasks
AGENT_TASKS_PATH=/data/ai-linux-agent-tasks.jsonl
AGENT_TASK_RESULTS_PATH=/data/ai-linux-agent-delivery.jsonl
AGENT_INBOX_PATH=/data/ai-linux-agent-inbox.jsonl
```
Replace example URLs with the **actual** agent endpoints; none are known or connected automatically. URLs must be HTTPS except local loopback HTTP. The bridge uses an outbound bearer token; use a private gateway, scoped credentials, and IP/network restrictions.

## Outgoing request
```http
POST {AGENT_TASK_URL}
Authorization: Bearer {AGENT_OUTBOUND_TOKEN}
Content-Type: application/json

{"taskId":"...","agent":"alex","text":"@alex check CI","channel":"Wszyscy","createdAt":"..."}
```
The agent endpoint should respond 2xx after it has durably accepted the task. Rejected or unreachable endpoints are recorded as failed.

## Result callback
The **actual agent or its trusted gateway** posts:
```http
POST /api/agents/messages
Authorization: Bearer {AGENT_INGEST_TOKEN}
Content-Type: application/json

{"agent":"Alex","channel":"Wszyscy","taskId":"<received taskId>","text":"Results with evidence / PR link"}
```
The server checks that taskId exists in the active process and matches the named agent, stores the message and emits SSE agent-message and agent-task-result events. Results appear in the chat. GET /api/agents/tasks/{id} requires AGENT_DISPATCH_TOKEN and shows active in-memory delivery status.

## Important limitations
- This code has not been end-to-end tested with the user's original agent endpoints.
- Task lookup is in-memory; process restarts lose correlation. Task and delivery logs persist only when /data is a persistent volume.
- No durable retries, message signing, per-agent credentials, or complete authorization/RBAC yet. Do not expose these endpoints publicly without a gateway.
- Chat currently prompts for dispatch token; production should use authenticated server-side sessions, not manual token entry.
- HTTP acceptance is not task completion. A result callback is necessary.
- Google AI Studio hosts the frontend/editor, not a permanent worker. Keep this bridge on the actual backend.
