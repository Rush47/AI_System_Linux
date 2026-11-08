# AI Linux — GitHub Codespaces

Open the repository in Codespaces on branch `feature/ubuntu-ai-linux-control-center`. The devcontainer starts the Control Center on port **3081**. In Codespaces > Ports, open port 3081; keep it **Private**. If the server is unavailable, run `bash .devcontainer/start-control-center.sh` and inspect `/tmp/ai-linux/control-center.log`.

This is a development environment, **not a full Ubuntu installation**. Root inside the Codespace is container-scoped and is not GitHub host root. No automatic arbitrary root execution is provided. The AI terminal currently **proposes** commands and does not execute them. Do not make port 3081 public until authentication is enforced on all sensitive endpoints.

The UI works without an AI model but AI chat requires reachable Ollama or configured Gemini fallback. Configure `OLLAMA_URL` or Gemini settings through Codespaces secrets/environment; never commit keys. OpenAI and GitHub integrations require `INTEGRATIONS_TOKEN`, `OPENAI_API_KEY`, and `GITHUB_TOKEN` in Codespaces secrets. The presence of these variables alone is not proof of connectivity.

For future ChatGPT MCP access, deploy a dedicated authenticated HTTPS MCP gateway with scoped tools and confirmation for privileged changes. This repository's Control Center API is **not** yet an MCP server.

Verify:
```sh
node --check deploy/control-center/server.mjs
curl -fsS http://127.0.0.1:3081/health
```
