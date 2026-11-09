# Bastilla_10 → AI System Linux (REST, bez MCP)

Dodano `agent_rest.py` jako pierwszy etap integracji. Moduł nie używa MCP.
Jest to **adapter zadań do Ollamy**, nie migracja oryginalnych tożsamości,
procesów, sekretów ani pamięci agentów z GitHub/AI Studio.

## Uruchomienie

W kontenerze lub na hoście z Python 3.10+ i osiągalną Ollamą:

```bash
export AGENT_API_TOKEN="$(openssl rand -hex 32)"
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
export AGENT_MODEL="thox-ai/thoxopen-8b-heretic:q4_k_m"
python3 integrations/bastilla10/agent_rest.py
```

Jeśli proces działa w sieci Docker z usługą Ollama, użyj
`OLLAMA_BASE_URL=http://ollama:11434`. Serwis nasłuchuje na porcie 8091;
nie wystawiaj go publicznie bez TLS i kontroli dostępu. Token zachowaj
lokalnie i nie zapisuj w repozytorium.

```bash
curl -H "Authorization: Bearer $AGENT_API_TOKEN" http://127.0.0.1:8091/agents
curl -X POST http://127.0.0.1:8091/tasks \
  -H "Authorization: Bearer $AGENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent":"Aria","description":"Przygotuj analizę stanu systemu"}'
# Odczytaj zwrócone id, następnie GET /tasks/<id>
```

## Aktualny zakres i ograniczenia

- `GET /health`, `GET /agents`, `POST /tasks`, `GET /tasks/{id}`.
- Zadania wykonuje lokalny model Ollama. Nazwy agentów są etykietami routingu,
  nie potwierdzonymi oryginalnymi instancjami.
- Rejestr zadań jest w pamięci procesu; po restarcie znika.
- Nie wykonuje komend powłoki ani nie nadaje uprawnień root.
- Nie zmienia istniejącego `docker-compose.yml`; usługę trzeba uruchomić osobno.
- Nie podłączono jeszcze UI Bastilla_10 do tego API.
- Nie przeniesiono oryginalnych agentów z konta `mmitek515-netizen`.
  Do właściwej migracji konieczne jest zidentyfikowanie ich działających
  endpointów, poświadczeń, uprawnień i pamięci.

## Dalsze prace

Zidentyfikować oryginalne runtime'y agentów, dodać autoryzowane połączenie
Bastilla_10 → API, trwałą kolejkę zadań oraz test end-to-end. Nie deklarować
ukończonej migracji przed potwierdzeniem rzeczywistego wykonania.
