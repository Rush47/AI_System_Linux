# AI Linux — GitHub Codespaces

Open the repository in Codespaces on branch `feature/ubuntu-ai-linux-control-center`. The devcontainer starts the Control Center on port **3081**. In Codespaces > Ports, open port 3081; keep it **Private**. If the server is unavailable, run `bash .devcontainer/start-control-center.sh` and inspect `/tmp/ai-linux/control-center.log`.

This is a development environment, **not a full Ubuntu installation**. Root inside the Codespace is container-scoped and is not GitHub host root. AI-generated terminal commands remain proposals. After an explicit browser confirmation, the separate terminal control executes only a fixed read-only allowlist (`uname`, `ps`, `df`, `free`, `git status`, `docker compose ps`) through `execFile`, never through a shell. The MCP `terminal_execute` tool has the same allowlist and requires the separate `MCP_TERMINAL_TOKEN`; no arbitrary or host-root execution is provided. Keep port 3081 **Private**.

The Control Center connects to Ollama through `127.0.0.1:11434`; Compose binds that port to loopback only, not to the Codespaces public interface. Chat streams Ollama output over SSE and stores up to 10 conversations in browser-local storage; it is not server-side or cross-device memory. Text attachments are read in the browser (up to 3 files, 200 KB each) and included in the prompt; PDF/image uploads are not supported. The verified model set is `thox-ai/thoxopen-8b-heretic:q4_k_m` and `maternion/spark-x2.5-heretic:4b`; pull them separately when creating a fresh Docker volume. Configure Gemini and API credentials through Codespaces secrets/environment; never commit keys. OpenAI chat requires `INTEGRATIONS_TOKEN` and `OPENAI_API_KEY`; the live GitHub repository status uses `GITHUB_TOKEN`. The presence of variables alone is not proof of connectivity.

LibreChat's separate MCP sidecar provides three read-only Linux information tools. The Control Center serves stateless Streamable HTTP internally at `/mcp` on private port 3081. A separate OAuth 2.1 gateway proxies it through public Codespaces port 3082 at `https://<codespace>-3082.<forwarding-domain>/mcp`; Codespaces terminates TLS and 3081 remains private. The gateway supports dynamic client registration, Authorization Code with PKCE S256, refresh tokens, Protected Resource Metadata, and Authorization Server Metadata. OAuth client registrations and refresh tokens are stored in ignored mode-0600 `.mcp-oauth-state.json`; access tokens are memory-only.

At the consent screen, authorize `mcp:operator` with the token in `.mcp-auth-token` to grant status and task tools. `mcp:terminal` requires the separate token in `.mcp-terminal-token` and grants only the diagnostic allowlist; both scopes can be granted together by providing both tokens. Tokens are local and never committed. Register the public URL above as the ChatGPT remote MCP connector; ChatGPT receives a scoped, short-lived OAuth access token and can refresh it.

Verify:
```sh
node --check deploy/control-center/server.mjs
curl -fsS http://127.0.0.1:3081/health
curl -fsS https://$CODESPACE_NAME-3082.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN/.well-known/oauth-authorization-server
```
