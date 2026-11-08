# AI Linux — GitHub Codespaces

Open the repository in Codespaces on branch `feature/ubuntu-ai-linux-control-center`. The devcontainer starts the Control Center on port **3081**. In Codespaces > Ports, open port 3081; keep it **Private**. If the server is unavailable, run `bash .devcontainer/start-control-center.sh` and inspect `/tmp/ai-linux/control-center.log`.

This is a development environment, **not a full Ubuntu installation**. Root inside the Codespace is container-scoped and is not GitHub host root. AI-generated terminal commands remain proposals. After an explicit browser confirmation, the separate terminal control executes only a fixed read-only allowlist (`uname`, `ps`, `df`, `free`, `git status`, `docker compose ps`) through `execFile`, never through a shell. The MCP `terminal_execute` tool has the same allowlist and requires the separate `MCP_TERMINAL_TOKEN`; no arbitrary or host-root execution is provided. Keep port 3081 **Private**.

The Control Center connects to Ollama through `127.0.0.1:11434`; Compose binds that port to loopback only, not to the Codespaces public interface. Chat streams Ollama output over SSE and stores up to 10 conversations in browser-local storage; it is not server-side or cross-device memory. Text attachments are read in the browser (up to 3 files, 200 KB each) and included in the prompt; PDF/image uploads are not supported. The verified model set is `thox-ai/thoxopen-8b-heretic:q4_k_m` and `maternion/spark-x2.5-heretic:4b`; pull them separately when creating a fresh Docker volume. Configure Gemini and API credentials through Codespaces secrets/environment; never commit keys. OpenAI chat requires `INTEGRATIONS_TOKEN` and `OPENAI_API_KEY`; the live GitHub repository status uses `GITHUB_TOKEN`. The presence of variables alone is not proof of connectivity.

LibreChat's separate MCP sidecar provides three read-only Linux information tools. The Control Center serves stateless Streamable HTTP internally at `/mcp` on private port 3081. A separate gateway proxies it through public Codespaces port 3082 at `https://<codespace>-3082.<forwarding-domain>/mcp`; Codespaces terminates TLS and 3081 remains private. The ChatGPT endpoint is configured without authentication for connectors that do not support OAuth.

The public ChatGPT endpoint exposes only `system_status`, `list_agents`, `get_task_status`, and `get_logs`. It does not expose agent messaging, task creation, or terminal diagnostics. OAuth discovery and authorization endpoints are disabled in anonymous mode. The gateway still uses its locally stored operator credential when forwarding allowed requests to the private Control Center; that credential is not sent to ChatGPT. Register the public URL above as the ChatGPT remote MCP connector and select no authentication.

Verify:
```sh
node --check deploy/control-center/server.mjs
curl -fsS http://127.0.0.1:3081/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://$CODESPACE_NAME-3082.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN/.well-known/oauth-authorization-server
```
