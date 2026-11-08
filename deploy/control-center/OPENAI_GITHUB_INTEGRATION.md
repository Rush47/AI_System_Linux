# AI Linux: OpenAI, ChatGPT, Codex, GitHub

Implemented server-side adapters:
- `POST /api/integrations/openai/chat` accepts `{"message":"..."}`, calls OpenAI Responses API, returns model response and response ID.
- `GET /api/integrations/github/repository` reads the configured repository using a GitHub token.
- `GET /api/integrations/status` shows **configuration flags, not live connection success**.
All three require `Authorization: Bearer <INTEGRATIONS_TOKEN>`. Configure `INTEGRATIONS_TOKEN`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY` on the server only, not in Google AI Studio browser code. Never commit real credentials.

Examples (replace the token locally, not in Git):
```sh
curl -H "Authorization: Bearer $INTEGRATIONS_TOKEN" http://127.0.0.1:3000/api/integrations/status
curl -H "Authorization: Bearer $INTEGRATIONS_TOKEN" http://127.0.0.1:3000/api/integrations/github/repository
curl -X POST -H "Authorization: Bearer $INTEGRATIONS_TOKEN" -H 'Content-Type: application/json' -d '{"message":"Zaproponuj plan testów"}' http://127.0.0.1:3000/api/integrations/openai/chat
```

ChatGPT login/subscription is distinct from OpenAI API billing/credentials. Codex cloud tasks are **not** implemented by this adapter; require an explicitly authorized Codex environment/connector. GitHub repo read access does not itself authorize Codex to edit code. Do not claim otherwise.

Security: keep APIs behind authenticated HTTPS reverse proxy, use least-privilege GitHub fine-grained token (read-only metadata for current endpoint), and add per-user sessions, rate limiting and audit logs before exposing to the internet. API calls may incur usage charges. No end-to-end deployment or connection verification was performed.
