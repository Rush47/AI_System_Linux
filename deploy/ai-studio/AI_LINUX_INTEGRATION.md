# AI Linux — Google AI Studio adaptation

Google AI Studio can build the browser interface but does not host a full Ubuntu OS, root shell, Ollama daemon or persistent ship workers.

## Integration architecture
- AI Studio frontend: large chat, Projects, Fleet, Fleet Apps, Research, Botany, Diagnostics, Agents and Terminal.
- Existing Node backend: deploy/control-center/server.mjs, hosted on Ubuntu or a suitable container host.
- Same-origin HTTPS reverse proxy routes /api/* to backend; /api/sync/events is SSE.
- Gemini keys stay server-side in Secret Manager; local Ollama stays on the host.
- Use durable encrypted storage for projects, ships, apps, labs and logs. JSON files in ephemeral containers are not durable.

## API contract
- GET /api/fleet, POST /api/fleet
- GET /api/projects, POST /api/projects
- GET /api/fleet-apps, POST /api/fleet-apps
- GET /api/labs, POST /api/labs
- POST /api/labs/estimate
- POST /api/system/chat
- GET /api/diagnostics/live
- GET /api/sync/events (SSE)

## Security before production
- Authenticate users at the proxy and authorize every backend route. Current shared operator tokens and public read endpoints are NOT ready for internet exposure.
- Do not place fleet tokens, API keys or encryption keys in browser JavaScript, AI Studio prompts or Git.
- TLS for all traffic, encryption at rest and encrypted backups; LUKS2/TPM2 only applies to a real Ubuntu host, not the AI Studio editor.
- Require explicit confirmation and policy checks before physical actions or privileged commands.
- Show real device reports only; mark AI-generated ETA as estimates.

## Paste into Google AI Studio Build
Build a responsive Polish-language AI Linux dashboard. Chat is the primary large view. Add real interactive modules: Fleet (ships, missions, telemetry), Projects (spacecraft design, tasks, stages), Fleet Apps (per-ship software), Research, Botany (plant strains and research compounds), Diagnostics, Agents (Aria, Alex, Astyria, Aurelius) and Terminal (safe proposals only). Integrate the same-origin REST endpoints above and subscribe to /api/sync/events to refresh changed modules. Show unconnected/unverified status when data is absent. Never simulate ships, agent activity, progress, medical efficacy or hardware execution. Do not include secrets in the frontend. Make the layout mobile-friendly, with long streaming chat and clear approvals for impactful actions.

## Outstanding deployment work
- Import these requirements into the user's specific AI Studio app.
- Set up authenticated HTTPS gateway, persistent database, Gemini server proxy, agent endpoints and hardware adapters.
- Verify end-to-end functionality and encryption on the actual deployment.
