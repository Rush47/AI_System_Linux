# AI Linux natural-language CLI

This is a real command executor in the Codespace user context, **not host root**.

Start Ollama with a suitable installed model, then use the recommended launcher (persistent token, no token committed to Git):

```bash
bash scripts/start-nlp-cli.sh
```

In a second private Codespaces terminal, read the token with `cat ~/.local/state/ai-linux/nlp-cli-token` and paste it into the GUI field `NLP_CLI_TOKEN`. The GUI returns `Unauthorized` (HTTP 401) if the field is empty or different from the token used by the running backend. Restart the backend after changing the token. This is separate from Linux root privileges.

Manual alternative:

```bash
export NLP_CLI_TOKEN="$(openssl rand -hex 32)"
export OLLAMA_MODEL="qwen3:8b"
node tools/ollama-cli/server.mjs
```

POST `/api/plan` with bearer token and JSON `{"instruction":"show running processes"}`. Review returned `id`, `command`, `explanation`. POST `/api/execute` with bearer token and `{"id":"...","command":"the exact proposed command","confirm":true}` to execute it. Plans expire after five minutes. Outputs are bounded, execution times out after 30 seconds.

The service binds localhost only and must not be forwarded publicly. It runs commands with the privileges of its own process; do not run as root. For privileged administration, use a separate approval-gated mechanism. Ollama may produce incorrect or unsafe commands. This service does not provide kernel modification privileges in Codespaces.

Future GUI: a prompt input, proposed-command preview, explicit Execute button, streamed terminal output, and command history.
