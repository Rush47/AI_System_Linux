# AI_System_Linux — Rush47

Projekt AILinux 26.04 AMD64 oraz przenośnego zestawu AI opartego na
LibreChat, Ollama i MCP.

## Status projektu

- Zweryfikowany obraz AILinux: `ailinux-26.04-amd64-20261013T144048Z.iso`
- SHA-256: `de744684375ccbc15d6be45acf567cb8549475e9c57cf812c1aed47a8da4b2c7`
- ISO nie jest przechowywane w Git. Bieżący oficjalny adres pobierania uzyskaj
  ze strony [ailinux.me](https://ailinux.me/), a następnie użyj:
  `bash scripts/download-ailinux.sh 'https://DIRECT-OFFICIAL-ISO-URL'`
- Gotowy plik wdrożeniowy Docker Compose znajduje się w
  [deploy/ai-studio/](deploy/ai-studio/). Uruchamia LibreChat, modele lokalne
  przez Ollama oraz ograniczony do odczytu serwer MCP.
- Konfiguracja wdrożeniowa nie oznacza, że system został zainstalowany na
  fizycznym komputerze AILinux. Wymaga hosta Linux z Docker Compose.
- Migracja oryginalnych agentów Aria, Alex, Astyria i Aurelius nie została
  wykonana. Zobacz [docs/AGENTS.md](docs/AGENTS.md).

## Szybki start AI

Wymagany jest Docker z Compose v2.24.4 lub nowszym oraz połączenie internetowe
podczas pobierania obrazów i modeli.

1. Utwórz prywatny plik `.env` na podstawie szablonu:

   ```sh
   cp deploy/ai-studio/.env.example .env
   ```

2. Wygeneruj unikalne sekrety i uzupełnij nimi `.env`:

   ```sh
   openssl rand -hex 32  # CREDS_KEY, JWT_SECRET, JWT_REFRESH_SECRET, MEILI_MASTER_KEY
   openssl rand -hex 16  # CREDS_IV
   ```

   Nie używaj tego samego wyniku do więcej niż jednej zmiennej. Nie dodawaj
   `.env` do Git ani nie przesyłaj go w czacie.
3. Przed pierwszym uruchomieniem ustaw `ALLOW_REGISTRATION=true` w `.env`,
   aby móc utworzyć konto administratora.
4. Uruchom cały zestaw:

   ```sh
   docker compose up -d --build
   ```

5. Otwórz `http://localhost:3080` i utwórz pierwsze konto administratora.
   Następnie ustaw `ALLOW_REGISTRATION=false` w `.env` i zastosuj:

   ```sh
   docker compose up -d --force-recreate api
   ```

6. Pobierz modele jednorazowo:

   ```sh
   docker compose exec ollama ollama pull thox-ai/thoxopen-8b-heretic:q4_k_m
   docker compose exec ollama ollama pull maternion/spark-x2.5-heretic:4b
   ```

Szczegóły konfiguracji, bezpieczeństwa, kopii zapasowych, migracji i
rozwiązywania problemów: [deploy/ai-studio/README.md](deploy/ai-studio/README.md).

## GitHub na Linuxie

Konfiguracja GitHub CLI i Git po HTTPS, z tokenem podawanym ukrytym wejściem
terminala:

```sh
sudo apt install gh
bash scripts/setup-github.sh
```

Wygeneruj classic personal access token w
[ustawieniach GitHub](https://github.com/settings/tokens). Do publicznych
repozytoriów wystarczyłby `public_repo`, ale logowanie tokenem przez GitHub CLI
wymaga co najmniej `repo`, `read:org` i `gist`. To oznacza szeroki dostęp classic
tokena, w tym do prywatnych repozytoriów konta. Dodaj `workflow` tylko wtedy,
gdy musisz wysyłać zmiany plików GitHub Actions. Jeśli chcesz ograniczyć dostęp
do jednego repozytorium, użyj fine-grained tokena zamiast classic.

Skrypt nie umieszcza tokena w argumentach procesu, pliku `.env` ani repozytorium.
Nie wklejaj go do czatu. Po konfiguracji sprawdź `gh auth status`; test push
wykonaj zwykłym `git push`. Szczegóły i ograniczenia: [docs/GITHUB.md](docs/GITHUB.md).

## AILinux ISO

Nie zapisuj obrazu ISO w Git — plik zajmuje kilka gigabajtów. Pobieranie i
weryfikacja sumy kontrolnej:

```sh
bash scripts/download-ailinux.sh 'https://DIRECT-OFFICIAL-ISO-URL'
```

## Oryginalni agenci

Źródłowe konto GitHub: `mmitek515-netizen`. Nie twórz zamienników o tych samych
tożsamościach. Przed migracją zweryfikuj dostęp do oryginalnych usług i
repozytoriów. Migrację uznaj za zakończoną dopiero po sprawdzeniu jej działania
end-to-end. Dostęp administratora i uprawnienia narzędzi muszą pozostać jawne
i kontrolowane.
