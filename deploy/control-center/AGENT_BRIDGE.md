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

## Verified discovery in AI Linux Codespaces — 2026-11-08
- The local workspace and the searched public source repositories do not contain `svl_agent_bridge.py`.
- `mmitek515-netizen/bastilla_1_2` returned GitHub 404. Available public repositories included `SVL_System`, `Bastilla_OS_2`, `Bastilla_OS_Ollama`, and `Debian_13`.
- `SVL_System` contains original `.github/agents/*.agent.md` profiles and an MCP bridge. Its source explicitly reports `liveWorkersVerified: false`; profiles are not running workers.
- `Bastilla_OS_2` contains `integrations/mcp/remote_server.py`. Its task writes are disabled unless `BASTILLA_REMOTE_MCP_WRITES=1` and `BASTILLA_REMOTE_API_TOKEN` are supplied. Its own deployment notes say the task route schema is unverified and the Cloud Run bridge is not deployed. Read-only GET checks of the documented host and status paths returned HTTP 404 in this Codespace.
- `Debian_13/debian13/system/AGENT_RUNTIME.md` explicitly says the four profiles are not background workers. Its original-agent registry reports execution unverified unless a real worker is independently verified.
- The running AI Linux backend reports `aria`, `alex`, `astyria`, and `aurelius` as unconfigured/offline. `ARIA_TASK_URL`, `ALEX_TASK_URL`, `ASTYRIA_TASK_URL`, `AURELIUS_TASK_URL`, `AGENT_DISPATCH_TOKEN`, `AGENT_OUTBOUND_TOKEN`, and `AGENT_INGEST_TOKEN` are absent from this Codespace. No agent task was sent.
- GitHub CLI authenticated as `Rush47` could read the public source repositories. Reading repository Actions secret names was denied (HTTP 403); the user-level Codespaces secret list returned no entries. Secret values were never requested or read.

### Requirements to establish a real connection
1. Provide the verified HTTPS task endpoint for each original agent, or deploy and independently verify the Bastilla remote API plus its exact request/response contract.
2. Set `AGENT_DISPATCH_TOKEN`, `AGENT_OUTBOUND_TOKEN`, and `AGENT_INGEST_TOKEN` in Codespaces secrets. Configure the four `*_TASK_URL` values only after their routes are confirmed.
3. If using the Bastilla MCP bridge, separately configure `BASTILLA_REMOTE_API_URL`, `BASTILLA_REMOTE_API_TOKEN`, and enable `BASTILLA_REMOTE_MCP_WRITES=1` only after the remote endpoint and write semantics are verified.
4. Perform a non-destructive task per agent and wait for an authenticated callback containing the matching `taskId`. HTTP 2xx acceptance alone is not proof that an original agent executed the task.
