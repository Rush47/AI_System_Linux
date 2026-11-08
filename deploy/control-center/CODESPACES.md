# AI Linux — GitHub Codespaces

Open the repository in Codespaces on branch `feature/ubuntu-ai-linux-control-center`. The devcontainer starts the Control Center on port **3081**. In Codespaces > Ports, open port 3081; keep it **Private**. If the server is unavailable, run `bash .devcontainer/start-control-center.sh` and inspect `/tmp/ai-linux/control-center.log`.

This is a development environment, **not a full Ubuntu installation**. Root inside the Codespace is container-scoped and is not GitHub host root. AI-generated terminal commands remain proposals. After an explicit browser confirmation, the separate terminal control executes only a fixed read-only allowlist (`uname`, `ps`, `df`, `free`, `git status`, `docker compose ps`) through `execFile`, never through a shell. The MCP `terminal_execute` tool has the same allowlist and requires the separate `MCP_TERMINAL_TOKEN`; no arbitrary or host-root execution is provided. Keep port 3081 **Private**.

The Control Center connects to Ollama through `127.0.0.1:11434`; Compose binds that port to loopback only, not to the Codespaces public interface. Chat streams Ollama output over SSE and stores up to 10 conversations in browser-local storage; it is not server-side or cross-device memory. Text attachments are read in the browser (up to 3 files, 200 KB each) and included in the prompt; PDF/image uploads are not supported. The verified model set is `thox-ai/thoxopen-8b-heretic:q4_k_m` and `maternion/spark-x2.5-heretic:4b`; pull them separately when creating a fresh Docker volume. Configure Gemini and API credentials through Codespaces secrets/environment; never commit keys. OpenAI chat requires `INTEGRATIONS_TOKEN` and `OPENAI_API_KEY`; the live GitHub repository status uses `GITHUB_TOKEN`. The presence of variables alone is not proof of connectivity.

LibreChat's separate MCP sidecar provides three read-only Linux information tools. The Control Center serves stateless Streamable HTTP at `/mcp` on private port 3081. Codespaces supplies HTTPS at `https://<codespace>-3081.<forwarding-domain>/mcp`; the Node listener itself uses HTTP inside the workspace. `MCP_AUTH_TOKEN` grants read and task-dispatch tools; the distinct `MCP_TERMINAL_TOKEN` grants read tools plus the diagnostic terminal allowlist. The Codespaces startup script generates these tokens into ignored, mode-0600 `.mcp-*-token` files when corresponding environment secrets are absent. Do not copy token values into source control.

This Codespaces port is private, so an external ChatGPT service cannot reach it directly. The Bearer-token endpoint is suitable for MCP clients that support static Bearer credentials, but this workspace has no OAuth authorization server/client registration. ChatGPT remote connector OAuth and public HTTPS ingress therefore remain unconfigured; do not make the port public as a substitute for OAuth.

Verify:
```sh
node --check deploy/control-center/server.mjs
curl -fsS http://127.0.0.1:3081/health
MCP_AUTH_TOKEN="$(<.mcp-auth-token)" node --input-type=module -e 'const r=await fetch("http://127.0.0.1:3081/mcp",{method:"POST",headers:{authorization:"Bearer "+process.env.MCP_AUTH_TOKEN,accept:"application/json, text/event-stream","content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"initialize",params:{protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"smoke",version:"1"}}})});console.log("MCP initialize HTTP",r.status);console.log(await r.text());if(!r.ok)process.exit(1)'
```
