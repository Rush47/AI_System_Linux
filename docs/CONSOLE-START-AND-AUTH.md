# AI Linux — naprawa Unauthorized i konsola root w Codespaces

## Jeden start
W Codespaces (repozytorium `Rush47/AI_System_Linux`):

```bash
git pull origin main
bash scripts/start-ai-linux-console.sh
```

Otwórz port 5173 jako **Private**. Backend działa na localhost:8765,
a Vite przekazuje żądania `/api` do backendu. Zatrzymanie skryptu
zatrzymuje oba procesy. Ollama musi być uruchomiona osobno i mieć model
wskazany przez `OLLAMA_MODEL`.

## Unauthorized (401)
Token backendu znajduje się wyłącznie w prywatnym pliku Codespaces:

```bash
cat ~/.local/state/ai-linux/nlp-cli-token
```

Wklej jego wartość do pola `NLP_CLI_TOKEN` w GUI. Nie publikuj go.
Token z poprzedniego uruchomienia backendu może być inny, jeśli poprzednio
ustawiono `NLP_CLI_TOKEN` ręcznie. Zatrzymaj stary backend i uruchom
nowy wspólnym skryptem. Port 8765 musi być wolny.

## Root w Codespaces
`Unauthorized` to błąd tokenu API, **nie** odmowa `sudo`.
Sprawdź uprawnienia konta w zwykłym terminalu Codespaces:

```bash
id
sudo -n id
```

Jeśli `sudo -n id` pokazuje `uid=0(root)`, możesz uruchomić
`sudo -i` w osobnym terminalu Codespaces. GUI NLP uruchamia polecenia
jako użytkownik procesu Node, nie jako root. Nie uruchamiaj backendu
NLP z `sudo`: jego polecenia są generowane przez model i wymagają
kontroli operatora. Codespaces nie daje roota hosta ani dostępu do
modyfikowania jego jądra.

## Oryginalni agenci GitHub Copilot
Profile Aria, Alex, Astyria, Aurelius zostały skopiowane z
`mmitek515-netizen/SVL_System/.github/agents` do
`Rush47/AI_System_Linux/.github/agents`. To profile Copilota, nie
działające samodzielnie procesy. Aby użyć ich w docelowym repozytorium,
otwórz to repo w środowisku GitHub Copilot obsługującym własnych
agentów i wybierz właściwy profil. Żaden token Ollama/REST nie
autoryzuje sesji Copilota.
