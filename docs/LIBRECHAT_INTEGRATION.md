# LibreChat w AI Linux

LibreChat jest osobną usługą `api` w głównym `docker-compose.yml`. Korzysta z MongoDB, Meilisearch, lokalnej Ollamy i odczytowego serwera MCP. W panelu AI Linux (port 3081) znajduje się teraz osobna pozycja **LibreChat**, otwierająca port 3080 na tym samym hoście.

## Pierwsza konfiguracja na Ubuntu

```bash
git switch feature/ubuntu-ai-linux-control-center
cp -n deploy/ai-studio/.env.example .env
# W pliku .env zastąp WSZYSTKIE REPLACE_WITH... losowymi wartościami.
# Klucze 64-znakowe: openssl rand -hex 32; CREDS_IV: openssl rand -hex 16.
# Tylko na czas założenia pierwszego konta ustaw ALLOW_REGISTRATION=true.
docker compose -f docker-compose.yml -f docker-compose.control-center.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.control-center.yml up -d --build
docker compose exec ollama ollama pull thox-ai/thoxopen-8b-heretic:q4_k_m
docker compose exec ollama ollama pull maternion/spark-x2.5-heretic:4b
```

Open `http://localhost:3080` for LibreChat and `http://localhost:3081` for AI Linux Control Center. Create your initial LibreChat account, then change `ALLOW_REGISTRATION=false` in `.env` and recreate the API container with `docker compose -f docker-compose.yml -f docker-compose.control-center.yml up -d api`.

The Ollama model names are configured but availability and runtime compatibility must be verified by the `ollama pull` commands. LibreChat offers 8B and 4B as selectable models; **automatic 8B-to-4B fallback is currently implemented in the separate Control Center System chat, not in LibreChat**.

## Access from another device

By default `HOST_BIND_IP=127.0.0.1` means the LibreChat web port is accessible only from the Ubuntu host. For LAN access, set `HOST_BIND_IP` to the Ubuntu machine's LAN IP and use `http://UBUNTU_LAN_IP:3080`. The Control Center port 3081 is also loopback-only by default, so use a local SSH tunnel or an authenticated HTTPS reverse proxy for remote access. Never expose LibreChat, its registration flow or admin services directly to the public internet without authentication, TLS and firewall rules.

## Verification

```bash
docker compose -f docker-compose.yml -f docker-compose.control-center.yml ps
docker compose -f docker-compose.yml -f docker-compose.control-center.yml logs --tail=100 api
docker compose exec ollama ollama list
```

The original agents Aria, Alex, Astyria and Aurelius are intentionally not connected yet; the user will connect them after importing the app to Google AI Studio. A GitHub commit does not install or start Docker services on Ubuntu.
