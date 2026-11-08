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

## Minimalny interfejs przyszłych narzędzi
`system_status`, `list_projects`, `github_repository_status`, `propose_command`, `execute_approved_command`, `task_status`, `agent_dispatch`, `agent_result`.

**Stan:** opis architektury i plan, a nie gotowa implementacja MCP/root. Obecny terminal ma tylko `/api/terminal/propose` i zwraca `executed:false`.

## Kryterium gotowości
W Codespaces użytkownik wpisuje polecenie naturalne; serwer pokazuje plan, autoryzację, realny wynik wykonania i log. W ChatGPT narzędzia MCP są widoczne i poprawnie zwracają dane. Integracje GitHub/Codex są potwierdzone osobno.
