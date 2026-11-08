# AI Linux Control Center — funkcje i faktyczny status

**Stan dokumentacji:** 2026-11-08. Repo: `Rush47/AI_System_Linux`, gałąź `feature/ubuntu-ai-linux-control-center`. „Zaimplementowane” oznacza kod w repo, nie potwierdzoną pracę na serwerze.

| Moduł | Implementacja | Ograniczenie |
|---|---|---|
| GUI Control Center | `index.html` | Podgląd wymaga uruchomienia Codespace |
| Czat lokalny AI | `POST /api/system/chat` | Wymaga Ollama; opcjonalny Gemini fallback |
| Terminal języka naturalnego | `POST /api/terminal/propose` | Tylko propozycja; `executed:false`, bez roota hosta |
| Diagnostyka | `GET /api/diagnostics/live` i predefiniowane odczyty | Nie jest diagnostyką całego hosta Ubuntu |
| Flota i telemetria | `fleet.mjs`, `fleet-map.js` | Brak potwierdzonych urządzeń; mapa schematyczna |
| Projekty | `projects.mjs`, `projects.js` | Wymagany trwały katalog danych |
| Aplikacje Floty | `fleet-apps.mjs`, `fleet-apps.js` | Rejestr, nie instalator na prawdziwych statkach |
| Botanika i badania | `ship-labs.mjs`, `ship-labs.js` | AI ETA to prognoza, nie pomiar |
| Wzmianki agentów | `POST /api/agents/mentions` | Wymaga realnych URL agentów i tokenów |
| Wyniki agentów | `POST /api/agents/messages` | Tylko uwierzytelniony callback z poprawnym taskId |
| OpenAI API | `integrations.mjs` | Wymaga osobnego API key; brak weryfikacji online |
| GitHub API | `integrations.mjs` | Odczyt metadanych; wymaga GITHUB_TOKEN |
| Codex | Planowana integracja | Brak działającego wykonawcy zadań Codex |
| ChatGPT MCP | Planowana integracja | Brak produkcyjnego zdalnego serwera MCP dla ChatGPT |
| Ubuntu root | Planowany kontrolowany executor | Niepodłączony; Codespaces root dotyczy kontenera |

## Minimalna weryfikacja
```sh
node --check deploy/control-center/server.mjs
curl -fsS http://127.0.0.1:3081/health
```
Dodatkowe testy integracji wykonuj dopiero po konfiguracji usług i sekretów. Nie oznaczaj zadań jako ukończonych wyłącznie na podstawie HTTP 2xx lub deklaracji modelu.

## Powiązane pliki
- [Uruchomienie Codespaces](CODESPACES.md)
- [OpenAI i GitHub](OPENAI_GITHUB_INTEGRATION.md)
- [Zadania agentów](AGENT_BRIDGE.md)
- [MCP i root](MCP_ROOT_PLAN.md)
