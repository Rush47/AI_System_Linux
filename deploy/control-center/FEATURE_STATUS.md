# AI Linux Control Center — funkcje i faktyczny status

**Stan dokumentacji:** 2026-11-08. Repo: `Rush47/AI_System_Linux`, gałąź `feature/ubuntu-ai-linux-control-center`. „Zaimplementowane” oznacza kod w repo, nie potwierdzoną pracę na serwerze.

| Moduł | Implementacja | Ograniczenie |
|---|---|---|
| GUI Control Center | `index.html`, `operations.js` | Działa na prywatnym porcie Codespaces 3081; zawiera widoki integracji, logów i bezpiecznego terminala |
| Czat lokalny AI | `POST /api/system/chat`, `POST /api/system/chat/stream` | SSE z tokenami Ollama, kontekst do 12 000 znaków, historia 10 rozmów lokalnie w przeglądarce; odpowiedź 8B i streaming 4B zweryfikowane |
| Pliki czatu | `chat-ui.js` | Podgląd i treść plików tekstowych do 200 KB/pliki, maksymalnie 3 pliki; brak obsługi PDF/obrazów i uploadu serwerowego |
| Terminal języka naturalnego | `POST /api/terminal/propose`, `POST /api/terminal/execute` | Model tylko proponuje komendy; osobny przycisk po potwierdzeniu wykonuje 6 stałych poleceń odczytowych przez `execFile`, bez powłoki i bez roota hosta |
| Ustawienia i logi | `GET /api/control/status`, `GET /api/control/logs` | Status GitHub i Ollama sprawdzany na żywo; logi ograniczone do 100 ostatnich linii lokalnego serwera |
| Diagnostyka | `GET /api/diagnostics/live` i predefiniowane odczyty | Nie jest diagnostyką całego hosta Ubuntu |
| Flota i telemetria | `fleet.mjs`, `fleet-map.js` | Brak potwierdzonych urządzeń; mapa schematyczna |
| Projekty | `projects.mjs`, `projects.js` | Wymagany trwały katalog danych |
| Aplikacje Floty | `fleet-apps.mjs`, `fleet-apps.js` | Rejestr, nie instalator na prawdziwych statkach |
| Botanika i badania | `ship-labs.mjs`, `ship-labs.js` | AI ETA to prognoza, nie pomiar |
| Wzmianki agentów | `POST /api/agents/mentions` | Wymaga realnych URL agentów i tokenów |
| Wyniki agentów | `POST /api/agents/messages` | Tylko uwierzytelniony callback z poprawnym taskId |
| MCP Control Center | `POST /mcp` | Streamable HTTP, stateless; bearer operatora dla odczytu/zadań i oddzielny bearer terminala |
| MCP narzędzia | `system_status`, `list_agents`, `send_message`, `create_task`, `get_task_status`, `get_logs`, `terminal_execute` | Status/callbacki są rzeczywiste; wysyłka zadań kończy się błędem bez endpointu; terminal to sześć poleceń odczytowych |
| OpenAI API | `integrations.mjs` | Wymaga osobnego API key; brak weryfikacji online |
| GitHub API | `integrations.mjs` | Odczyt repozytorium zweryfikowany w tym Codespace przez `GITHUB_TOKEN`; brak operacji zapisu |
| Codex | Planowana integracja | Brak działającego wykonawcy zadań Codex |
| MCP LibreChat | `deploy/ai-studio/mcp-linux-info/server.js` | W tym Codespace health i `tools/list` zwróciły 3 narzędzia tylko do odczytu |
| Zdalny ChatGPT MCP | `https://<codespace>-3082.<forwarding-domain>/mcp` | Bez logowania; anonimowy dostęp ograniczony do `system_status`, `list_agents`, `get_task_status` i `get_logs`; Control Center 3081 nadal prywatny |
| Ubuntu root | Planowany kontrolowany executor | Niepodłączony; terminal wykonuje wyłącznie allowlistę odczytową w kontenerze Codespaces |

## Zweryfikowany stan Codespaces
- Control Center działa na `0.0.0.0:3081`; konfiguracja Codespaces ustawia przekierowanie portu 3081 jako prywatne.
- Ollama API jest dostępne wyłącznie przez `127.0.0.1:11434`, nie przez publiczny interfejs.
- Zainstalowane modele: `thox-ai/thoxopen-8b-heretic:q4_k_m` oraz `maternion/spark-x2.5-heretic:4b`.
- OpenAI/Gemini klucze, Codex i oryginalne endpointy agentów nie są skonfigurowane w bieżącym środowisku.
- MCP `initialize`, `tools/list`, `tools/call system_status` i `terminal_execute` zostały zweryfikowane; brak bearer daje HTTP 401. Task do niepodłączonej Aria zwrócił `isError` i nie zmienił logu.
- Publiczny MCP endpoint: `https://<codespace>-3082.<forwarding-domain>/mcp`; tryb ChatGPT bez autoryzacji udostępnia wyłącznie narzędzia odczytowe. 3081 pozostaje prywatny.
- Pliki `.mcp-auth-token` i `.mcp-terminal-token` (mode 0600) służą wyłącznie do uwierzytelnienia gatewaya wobec prywatnego Control Center; nie są przekazywane klientowi ChatGPT.
- Historia czatu jest przechowywana wyłącznie w `localStorage` przeglądarki; nie jest współdzielona między urządzeniami ani wysyłana jako pamięć długoterminowa serwera.

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
