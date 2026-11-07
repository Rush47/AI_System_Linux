# LibreChat, Ollama i Ubuntu MCP

Ten katalog wraz z głównym plikiem [`docker-compose.yml`](../../docker-compose.yml)
opisuje samodzielny, przenośny stos AI. Nie zawiera sekretów ani wag modeli.

## Usługi

- **LibreChat** — interfejs WWW, domyślnie na `http://localhost:3080`.
- **Ollama CPU-only** — obraz jest budowany na bazie oficjalnego obrazu Ollama,
  ale nie zawiera zbędnych bibliotek GPU. Port `11434` nie jest publikowany na
  hoście; API jest dostępne tylko przez sieć Docker. Połączenia z Ollama Cloud
  są wyłączone.
- **THOX Open Qwen3 8B Heretic Q4_K_M** — model główny; około 5 GB, kontekst
  ograniczony do 8K.
- **Spark-X2.5 4B Heretic** — mniejszy, ręczny fallback do zwykłego czatu;
  około 2,6 GB. LibreChat nie przełącza na niego automatycznie.
- **Ubuntu System Info MCP** — trzy narzędzia tylko do odczytu: dystrybucja,
  zasoby CPU/pamięci oraz pojemność systemu plików. Nie wykonuje poleceń, nie
  zmienia plików i nie widzi hosta.
- **MongoDB i Meilisearch** — dane rozmów i wyszukiwanie, bez opublikowanych
  portów hosta.

THOX Open 8B został sprawdzony pod kątem wywołania narzędzia MCP. W testach
Spark 4B nie wywołał MCP mimo jawnej prośby; wybieraj 8B do rozmów z
narzędziami, a 4B do zwykłego czatu. Oba modele są uruchamiane przez CPU i mogą
odpowiadać powoli. Ollama ładuje jeden model naraz, używa 8K kontekstu i zwalnia
model po pięciu minutach bezczynności.

Modele Heretic mają ograniczone wbudowane odmowy, a ich wyjście nie jest
wiarygodną warstwą bezpieczeństwa. Nie wystawiaj portu Ollama publicznie i nie
pozwalaj, aby odpowiedzi modelu uruchamiały niekontrolowane działania. MCP
Ubuntu celowo nie udostępnia shella ani zapisu.

## Instalacja

W katalogu głównym repozytorium:

```sh
cp deploy/ai-studio/.env.example .env
```

Uzupełnij wszystkie wymagane sekrety w `.env`. Generuj osobną wartość dla
każdego klucza:

```sh
openssl rand -hex 32  # CREDS_KEY (64 znaki), JWT_SECRET, JWT_REFRESH_SECRET, MEILI_MASTER_KEY
openssl rand -hex 16  # CREDS_IV (32 znaki)
```

Nie zapisuj `.env` w Git ani nie wklejaj go do czatu. Następnie zbuduj i
uruchom usługi:

```sh
docker compose up -d --build
docker compose exec ollama ollama pull thox-ai/thoxopen-8b-heretic:q4_k_m
docker compose exec ollama ollama pull maternion/spark-x2.5-heretic:4b
```

Pierwsze pobranie obrazów i modeli wymaga internetu. Wagi są przechowywane w
wolumenie `ollama_data`; nie są commitowane do repozytorium.

Otwórz `http://localhost:3080`. W Codespaces ustaw `HOST_BIND_IP=0.0.0.0` w
`.env`, aby forwarding portu działał, i ustaw port 3080 jako **Private** w
zakładce **Ports**. Nie wystawiaj API Ollama (11434), MongoDB ani Meilisearch.

Szablon `.env.example` domyślnie wyłącza rejestrację. Przed pierwszym
uruchomieniem ustaw tymczasowo `ALLOW_REGISTRATION=true` w `.env`. Pierwsze
konto utworzone w LibreChat otrzyma rolę administratora. Zaraz po utworzeniu
konta ustaw w `.env`:

```dotenv
ALLOW_REGISTRATION=false
```

Zastosuj zmianę:

```sh
docker compose up -d --force-recreate api
```

W selektorze LibreChat wybierz **Ollama → thox-ai/thoxopen-8b-heretic:q4_k_m**
do pracy z MCP. Wybierz **maternion/spark-x2.5-heretic:4b**, gdy potrzebujesz
szybszego zwykłego czatu.

## OpenAI

OpenAI API jest opcjonalne. Klucz wprowadź lokalnie jako `OPENAI_API_KEY` w
`.env`. Subskrypcja ChatGPT nie obejmuje rozliczeń API. Żądania do OpenAI są
wysyłane do dostawcy i mogą powodować opłaty. Lokalne modele Ollama nie
wymagają klucza dostawcy.

## Operacje

```sh
# Status
docker compose ps

# Wagi modeli
docker compose exec ollama ollama list

# Ostatnie logi (przed udostępnieniem sprawdź, czy nie zawierają danych rozmów)
docker compose logs --tail=100 api ollama ubuntu-system-info

# Zatrzymaj usługi, zachowując dane
docker compose down

# Uruchom ponownie
docker compose up -d
```

Nie używaj `docker compose down -v`, jeśli chcesz zachować bazę danych, pliki
użytkownika lub wagi Ollama.

## Dane i kopie zapasowe

Compose przechowuje dane w wolumenach `mongodb_data`, `meilisearch_data`,
`librechat_data`, `librechat_uploads` i `ollama_data`. Przy migracji przenoś
wolumeny przez kopię zapasową wykonaną zgodnie z dokumentacją Dockera albo
pobierz modele ponownie. Wykonuj kopie po zatrzymaniu usługi, której dane
archiwizujesz. Sekrety `.env` zabezpiecz osobno — utrata `CREDS_KEY` lub
`CREDS_IV` może uniemożliwić odszyfrowanie zapisanych poświadczeń.

Ten Compose może działać na AILinux lub innym hoście Linux z Docker Compose
v2.24.4+. Google AI Studio jest usługą do pracy z modelami, a nie hostem
kontenerów.

## Rozwiązywanie problemów

- **Port 3080 nie odpowiada:** sprawdź `docker compose ps` i
  `docker compose logs --tail=100 api`; upewnij się, że forwarding jest
  włączony, jeśli używasz Codespaces.
- **Pusta lista modeli:** sprawdź `docker compose exec ollama ollama list` i
  pobierz brakujący model poleceniem `ollama pull`.
- **Ollama nie łączy się z LibreChat:** użyj adresu
  `http://ollama:11434/v1/` z `librechat.yaml`. Nie zmieniaj go na `localhost`.
- **MCP nie pojawia się w LibreChat:** sprawdź `docker compose ps` i logi
  `api` oraz `ubuntu-system-info`. Po zmianie `librechat.yaml` odtwórz API:
  `docker compose up -d --force-recreate api`.
- **Wolne odpowiedzi:** to środowisko CPU-only. Przełącz ręcznie na model 4B
  albo uruchom zestaw na hoście z GPU.
- **Błąd konfiguracji Meilisearch:** sprawdź, czy `MEILI_MASTER_KEY` w `.env`
  jest unikalnym, wygenerowanym sekretem.

## Aktualizacja

Obrazy LibreChat i Ollama mają tagi `latest`; aktualizacje upstream mogą
zmieniać zachowanie. Przed aktualizacją zrób kopię zapasową, pobierz aktualne
obrazy i zweryfikuj stos:

```sh
docker compose pull
docker compose up -d --build
docker compose ps
```

Wdrożenie wymaga Docker Compose v2.24.4 lub nowszego.
