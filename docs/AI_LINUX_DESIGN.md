# AI Linux — zatwierdzone założenia projektu

Status: specyfikacja projektu; **nie oznacza wdrożenia ani działających integracji**.

## Nazwa i repozytorium
- Nazwa aplikacji i systemu: **AI Linux**.
- Repozytorium bazowe: `Rush47/AI_System_Linux`.
- Docelowa aplikacja webowa, responsywna na komputerach i telefonach.
- Firebase planowane do hostingu, uwierzytelniania i synchronizacji danych. Połączenie Firebase z ChatGPT nie zostało zakończone.

## Grafiki — nie zastępować nowymi
- Używać **wcześniej zatwierdzonych oryginalnych plików** (jeśli zostaną odnalezione/dostarczone), a nie generować automatycznie zamienników.
- Ikona: realistyczna Ziemia na czarnym tle, **bez napisu AI Linux**.
- Oddzielny napis/logo AI Linux, w uzgodnionym srebrno-niebieskim charakterze.
- Ekran startowy: naturalna, realistyczna Ziemia oraz pasek ładowania.
- Tapeta: fotograficznie realistyczna Ziemia, nie fantastyczna planeta.
- Nie deklarować, że oryginalne grafiki zostały zapisane, dopóki nie odnajdziemy ich plików i nie dodamy do repozytorium.

## Interfejs
- Ciemny, minimalistyczny, futurystyczny.
- **Główny i największy element: bardzo duży interaktywny czat**, podobny do ChatGPT, z długimi odpowiedziami i strumieniowaniem.
- Prawdziwe działające komponenty UI, **nie obrazki udające przyciski, terminal lub dashboard**.
- Interaktywny terminal Linux, diagnostyka CPU/RAM/procesów/logów, status MCP, Ollama i GitHub.
- Zdalny pulpit oraz widoki sesji, mobilny interfejs.
- Kolejka zadań, postęp, historia i możliwość komunikacji dwukierunkowej.

## Agenci — zachować oryginały
- Aria, Alex, Astyria, Aurelius — osobne kanały i kanał „Wszyscy”.
- Połączenie z **rzeczywistymi oryginalnymi procesami agentów** przez uwierzytelnione API/MCP.
- Nie zastępować ich atrapami, statycznymi odpowiedziami, innymi modelami ani profilami Copilot.
- Status agenta „online” tylko po rzeczywistym heartbeat/odpowiedzi endpointu.
- Repozytorium Bastilla_1_2 zawiera profile i most live-chat, ale obecność oryginalnych działających runtime'ów i ich adresów wymaga potwierdzenia.

## Architektura
- Zachować istniejącą infrastrukturę repozytorium (Docker Compose, LibreChat, Ollama, MCP), rozszerzając ją zamiast bezmyślnie nadpisywać.
- React/TypeScript jako proponowany frontend.
- Firebase Hosting/Auth/Firestore po konfiguracji projektu i połączeniu poświadczeń; Firebase **nie uruchamia sam z siebie** Linuxa, powłoki root ani Ollamy.
- Backend Linux i procesy agentów jako niezależne usługi z kontrolą dostępu.
- Uprzywilejowane działania systemowe wykonywać przez autoryzowany, audytowany backend, a nie bezpośrednio z przeglądarki.
- GitHub jako źródło kodu; synchronizacja danych w czasie rzeczywistym, gdzie to możliwe.

## Kolejne kroki
1. Odnaleźć zatwierdzone pliki graficzne i umieścić je w katalogu zasobów aplikacji.
2. Dodać frontend i interaktywne komponenty do repozytorium.
3. Przygotować konfigurację Firebase bez wpisywania sekretów do Git.
4. Ustalić prawdziwe adresy API agentów i przetestować połączenia.
5. Testować i wdrażać; nie oznaczać funkcji jako gotowych bez potwierdzenia.

Ten dokument utrwala ustalenia, nie jest zamiennikiem kodu ani plików graficznych.
