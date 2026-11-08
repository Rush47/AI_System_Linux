# Terminal Binarnej Hiperprzestrzeni — AI Linux

Przywrócony jako osobna zakładka w `gui/src/main.jsx`. Backend: `POST /api/hyperos/console` w `tools/ollama-cli/server.mjs`, autoryzowany nagłówkiem `Authorization: Bearer <NLP_CLI_TOKEN>`.

## Pochodzenie
Odtworzony na podstawie `Bastilla_1_2/src/components/TerminalView.tsx`, `src/kernel/hyperos.ts`, `Nowy_system/kernel/binary_hyperspace_kernel.py` i endpointu w `server.ts`.

## Działanie
- 128-bitowy deterministyczny wektor z SHA-256 i porównanie odległością Hamminga do czterech kotwic: SYSTEM, CHAT, COMPUTE, DIAGNOSTIC.
- Zapytanie do lokalnej Ollamy i wyświetlenie realnej odpowiedzi modelu.
- Wektor, intencja, podobieństwo i odpowiedź widoczne w interfejsie.
- Ostatnie 100 wyników przechowywane **w pamięci procesu** (restart je usuwa).
- W przeciwieństwie do poprzedniej wersji Bastilla, obecna implementacja **nie wykonuje komend jądra SVL** i **nie używa OpenRouter**. Do rzeczywistej powłoki służy osobna zakładka Terminal NLP.
- Nie jest to fizyczna/kwantowa transmisja, a wektor diagnostyczny nie jest semantycznie wytrenowanym modelem.

## Uruchomienie
Ustaw `NLP_CLI_TOKEN`, uruchom `bash scripts/start-ai-linux-gui.sh`, otwórz port 5173 Codespaces i wpisz token w zakładce Binarna Hiperprzestrzeń. Ollama musi działać pod `OLLAMA_URL` i mieć model `OLLAMA_MODEL` (domyślnie qwen3:8b).

Zmiany są na gałęzi `feature/mcp-read-write-agent-bridge`, PR #2, bez automatycznego scalenia z main. Nie zweryfikowano uruchomienia w Codespaces.
