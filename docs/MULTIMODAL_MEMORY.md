# AI Linux: multimodal tools and persistent memory

## Persistent memory
Run `python3 deploy/host-worker/ai_memory.py add --owner aria --text "..." --scope private`.
Use `--scope shared` to expose an entry to all agents. Other actions: `list`, `search --text "..."`, `delete --id N`.
Owners: system, aria, alex, astyria, aurelius. SQLite survives process restarts if the database directory is on persistent storage. Set `AI_LINUX_MEMORY_DB` to a persistent host path; back it up and encrypt its storage. The CLI is a local building block, **not yet integrated into chat or agents**. SQLite owner filtering is not a security boundary: expose it only through authenticated per-agent services. Stored memories are data, not privileged instructions. Provide deletion and retention policies before production.

## Image generation (DALL·E 3 / current image API)
Integrate OpenAI Images API through a server-side adapter, with credentials in secrets/environment, never in frontend or Git. Model availability depends on the API account; do not assume DALL·E 3 availability. ChatGPT Plus subscription does not grant external API credits. Store generated files in a durable volume and publish file-created events to Global Sync. **Not yet connected**.

## Codex
Use the supported Codex CLI or official GitHub integration with authenticated account access. Run in an isolated workspace with explicit repository permissions; do not expose unprotected root execution. Codex access and billing depend on the chosen authentication mode. **Not yet connected**.

## Real Vision
Support image input through a configured vision-capable model (e.g. Ollama vision models or an eligible OpenAI API model). Check actual model capabilities before enabling uploads. No webcam access or visual processing is active without a running model and explicit input. **Not yet connected**.

## Architecture
Chat/terminal/agent event -> authenticated service -> persistent state -> SSE notifications -> clients refresh authoritative state. SSE by itself does not persist or synchronize independent hosts. Use a shared event store and replay mechanism before claiming global cross-instance sync.
