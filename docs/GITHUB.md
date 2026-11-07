# GitHub CLI i Git na Linuxie

Repozytorium używa GitHub CLI (`gh`) jako credential helpera dla Git przez
HTTPS. Token nie trafia do repozytorium, `.env`, URL remote ani argumentów
poleceń. `gh` użyje systemowego magazynu poświadczeń, jeśli jest dostępny; w
przeciwnym razie może zapisać token w `~/.config/gh/hosts.yml`. Zabezpiecz
konto użytkownika i sprawdź komunikat `gh auth status`, który wskazuje sposób
przechowywania poświadczeń.

## Konfiguracja

Na Ubuntu/Debian z pakietem `gh`:

```sh
sudo apt update
sudo apt install gh
bash scripts/setup-github.sh
```

Jeśli pakiet nie jest dostępny dla dystrybucji, zainstaluj GitHub CLI zgodnie z
[oficjalnymi instrukcjami](https://github.com/cli/cli/blob/trunk/docs/install_linux.md).
Uruchom skrypt z interaktywnego terminala. Token jest wczytywany bez echa i
przekazywany do `gh auth login` przez standardowe wejście. Po zalogowaniu
`gh auth setup-git` konfiguruje `gh` jako pośrednika poświadczeń Git.

## Classic personal access token

Utwórz token w [GitHub Settings → Developer settings → Personal access tokens
(classic)](https://github.com/settings/tokens). `gh auth login --with-token`
wymaga co najmniej scope'ów `repo`, `read:org` i `gist`. Ustaw krótki,
uzasadniony termin ważności i pamiętaj, że `repo` daje dostęp do wszystkich
prywatnych repozytoriów, do których konto ma uprawnienia. Classic token nie
może być ograniczony do jednego repozytorium.

- `public_repo` jest węższy i wystarcza do operacji Git na publicznych
  repozytoriach, ale nie spełnia minimalnych wymagań `gh auth login --with-token`.
- Wybierając `repo`, zaakceptuj dostęp tokena do wszystkich prywatnych
  repozytoriów konta.
- `workflow` dodaj wyłącznie, jeśli będziesz wysyłać zmiany plików
  `.github/workflows`.

Nie udzielaj scope'ów administracyjnych, jeśli nie są wymagane. Jeśli taki
zakres dostępu jest zbyt szeroki, użyj fine-grained tokena ograniczonego do
wybranego repozytorium i skonfiguruj go jako `GH_TOKEN` zgodnie z dokumentacją
GitHub CLI. W organizacji z SSO może być konieczne osobne autoryzowanie tokena.

## Weryfikacja i użycie

Jeśli token przechowujesz w ignorowanym przez Git pliku `.env` w katalogu
głównym repozytorium, udostępnij go tylko procesowi GitHub CLI w bieżącym
terminalu:

```sh
export GH_TOKEN="$(sed -n 's/^GH_TOKEN=//p' .env)"
gh auth status
```

Pole `GH_TOKEN` w `.env` nie jest przekazywane do kontenera LibreChat.
Bezpieczniejszą alternatywą jest `bash scripts/setup-github.sh`, który pobiera
token ukrytym wpisem i konfiguruje lokalny magazyn poświadczeń `gh`.

```sh
gh auth status
git remote -v
git push
```

Nie wstawiaj tokena do URL `origin`, zmiennych współdzielonych, historii powłoki
ani wiadomości. W razie podejrzenia wycieku unieważnij token w ustawieniach
GitHub i utwórz nowy. Wylogowanie usuwa lokalną autoryzację:

```sh
gh auth logout --hostname github.com
```

Jeśli `gh auth status` nie działa, nie próbuj umieszczać tokena w komendzie
`git push`; sprawdź scope'y tokena, datę ważności, SSO organizacji oraz
uprawnienie konta do zapisu w docelowym repozytorium.
