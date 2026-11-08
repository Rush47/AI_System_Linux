# MCP + język naturalny + Ubuntu/Codespaces — plan wdrożenia

## Cel
Operator wydaje po polsku lub angielsku dowolne polecenie w czacie/terminalu; AI klasyfikuje intencję i wybiera dostępne narzędzie. **Dowolność języka nie oznacza nieograniczonego wykonywania**: jeśli narzędzie nie istnieje, system zgłasza ograniczenie zamiast udawać sukces.

## Docelowy przepływ
1. Czat → parser intencji / model → ustrukturyzowany plan narzędzi.
2. Router MCP wybiera narzędzie i uprawnienia: odczyt systemu, GitHub, projekty, agenci, terminal.
3. Executor Ubuntu realizuje dozwolone zadanie, zapisuje stdout/stderr, kod wyjścia, identyfikator zadania, czas i zakres uprawnień.
4. UI odbiera statusy i wyniki strumieniowo, z możliwością przerwania.
5. Operacje destrukcyjne, instalacja oprogramowania, dostęp do sekretów i zmiany systemowe wymagają jawnej akceptacji.

## Etap Codespaces
- Działa jako kontener developerski, nie daje root do hosta GitHub.
- Zacząć od MCP z narzędziami tylko do odczytu i GitHub, następnie dodać ograniczone narzędzia wykonawcze.
- Połączyć z ChatGPT dopiero po wystawieniu uwierzytelnionego HTTPS MCP endpointu lub tunelu.
- Nie udostępniać publicznie surowego shella ani tokenów. Nie uruchamiać odpowiedzi modelu bezpośrednio przez `sh -c`.
- Nie zakładać, że ChatGPT login = OpenAI API key lub że GitHub connector = wykonawca Codex.

## Narzędzia MCP
`system_status`, `list_projects`, `github_repository_status`, `propose_command`, `execute_approved_command`, `task_status`, `agent_dispatch`, `agent_result`.

**Stan:** Control Center udostępnia stateless Streamable HTTP MCP na `/mcp`, chronione oddzielnymi tokenami bearer operatora i terminala. Narzędzia statusu, agentów, zadań i logów korzystają z rzeczywistych handlerów lokalnych. MCP `terminal_execute` i UI `/api/terminal/execute` przyjmują wyłącznie identyfikatory sześciu stałych poleceń odczytowych, uruchamiają je przez `execFile` w kontenerze Codespaces; nie ma shella ani roota hosta. Zdalny ChatGPT nie ma dostępu do prywatnego portu Codespaces, a OAuth/publiczny gateway pozostają niepodłączone.

Wdrożone nazwy narzędzi: `system_status`, `list_agents`, `send_message`, `create_task`, `get_task_status`, `get_logs`, `terminal_execute`. Operator token ma dostęp do pierwszych sześciu, terminal token do narzędzi odczytowych i `terminal_execute`. Wysyłka do agenta wymaga skonfigurowanego endpointu i `AGENT_OUTBOUND_TOKEN`; sam HTTP 2xx nie oznacza wykonania.

## Kryterium gotowości
W Codespaces użytkownik wpisuje polecenie naturalne; serwer pokazuje plan, autoryzację, realny wynik wykonania i log. W ChatGPT narzędzia MCP są widoczne i poprawnie zwracają dane. Integracje GitHub/Codex są potwierdzone osobno.
