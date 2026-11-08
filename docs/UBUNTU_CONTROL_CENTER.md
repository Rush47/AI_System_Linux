# AI Linux Control Center — Ubuntu

Pierwszy działający etap interfejsu WWW: responsywny pulpit, kanały agentów, sekcja terminala i diagnostyki. Nie ma atrap odpowiedzi AI, wykonawcy root ani udawanych pomiarów.

## Uruchomienie na Ubuntu

Wymagane: Ubuntu z Docker Engine i Docker Compose v2.

```bash
git clone https://github.com/Rush47/AI_System_Linux.git
cd AI_System_Linux
git switch feature/ubuntu-ai-linux-control-center
cp deploy/ai-studio/.env.example .env\n# Uzupełnij unikalne sekrety zgodnie z głównym README.\ndocker compose -f docker-compose.yml -f docker-compose.control-center.yml up -d --build\ndocker compose exec ollama ollama pull thox-ai/thoxopen-8b-heretic:q4_k_m
```

Otwórz http://localhost:3081 . Serwer jest domyślnie dostępny tylko lokalnie. Kanał **System** wysyła prawdziwe zapytania do lokalnej Ollamy 8B; nie ma dostępu do powłoki ani narzędzi systemowych. Każda wiadomość jest osobnym zapytaniem bez trwałej pamięci konwersacji.

Aby uruchomić również istniejący LibreChat, Ollamę i MCP, najpierw przygotuj `.env` zgodnie z głównym README, a następnie wykonaj:

```bash
docker compose up -d --build
```

LibreChat: http://localhost:3080. Link w interfejsie zakłada dostęp lokalny z komputera, na którym otwierana jest aplikacja; dla zdalnego klienta wymaga skonfigurowania prawidłowego adresu i bezpiecznego proxy.

## Stan funkcji

- Działa: interfejs HTML/CSS/JS, nawigacja, wybór kanału, formularz wiadomości, widoki agentów, terminala i diagnostyki.
- Kanał System: po uruchomieniu pełnego Compose i pobraniu modelu wysyła żądania do Ollama 8B. Nie został zweryfikowany na działającym Ubuntu.\n- Niepodłączone: autentyczne runtime'y Aria/Alex/Astyria/Aurelius, wykonawca terminala, telemetria, Firebase, logowanie i synchronizacja GitHub.
- Wiadomości do kanału System trafiają do lokalnej Ollamy; wiadomości do pozostałych agentów nie trafiają do agentów; aplikacja pokazuje jednoznaczny komunikat, zamiast udawać odpowiedź.
- Grafiki zatwierdzone wcześniej nie zostały odnalezione w repozytorium; nie zastępuj ich losowymi obrazami.
- Przed udostępnieniem przez internet wymagane są TLS, uwierzytelnienie, autoryzacja i odpowiednie reguły sieciowe.

Plan kolejnego etapu: połączyć autentyczne API agentów z backendem, dodać bezpieczną telemetrię Ubuntu i Firebase, a następnie podmienić tymczasowe elementy wizualne na oryginalne grafiki.
