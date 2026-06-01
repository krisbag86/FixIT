# Build Status - FixIT Helpdesk

Dokument aktualizowany po kolejnych etapach budowy aplikacji.

Aktualna kolejka pozostalych prac znajduje sie w `remaining-tasks.md`. Sekcje `Do zbudowania` przy starszych etapach maja charakter historyczny i pokazuja, co bylo brakujace w danym momencie budowy.

## Etap 0 - Przeglad dokumentacji

Status: zrobione.

Zrobione:

- Przejrzano dokumenty produktowe, UX, auth/security, database schema, testing/quality, deployment oraz taski dla agentow.
- Ustalono pionowy zakres MVP: logowanie domena `bagietka.pl`, role, tworzenie ticketu, lista ticketow, kolejka IT, status/przypisanie, komentarze i log powiadomien.
- Zidentyfikowano brak aplikacji w repo. Repo zawieralo wylacznie dokumentacje.

Do zbudowania:

- Aplikacja Next.js App Router.
- Warstwa danych dla lokalnego developmentu oraz kontrakt Prisma/PostgreSQL.
- Widoki portalu zglaszajacego i panelu IT.
- Testy walidacji domeny, permissions i numeracji ticketow.

## Etap 1 - Fundament aplikacji

Status: zrobione.

Zrobione:

- Dodano `package.json` ze skryptami `dev`, `build`, `lint`, `typecheck`, `test`.
- Dodano konfiguracje TypeScript, Next.js, Tailwind CSS, PostCSS i ESLint.
- Dodano globalne style z obsluga light/dark mode.
- Zaktualizowano glowny `README.md` o start lokalny, konta testowe i komendy walidacyjne.
- Dodano shell aplikacji, login form, badge statusow/priorytetow/rol i podstawowe komponenty UI.

Do zbudowania:

- Routing i widoki aplikacji.
- Lokalny store danych i akcje formularzy.

## Etap 2 - Logika domenowa i dane

Status: zrobione.

Zrobione:

- Dodano typy domenowe: uzytkownicy, sklepy, kategorie, tickety, komentarze, eventy i log powiadomien.
- Dodano walidacje dokladnej domeny `bagietka.pl` z normalizacja emaila.
- Dodano centralny helper permissions dla rol `REPORTER`, `STORE_MANAGER`, `AGENT`, `ADMIN`.
- Dodano numeracje ticketow w formacie `IT-YYYY-NNNN`.
- Dodano lokalny JSON-store `.data/fixit-db.json` z seedem, zeby aplikacja dzialala bez zewnetrznej bazy w development.
- Dodano akcje serwerowe: login/logout, tworzenie ticketu, aktualizacja statusu/priorytetu/assignee, komentarze publiczne i notatki wewnetrzne.
- Dodano `prisma/schema.prisma` jako docelowy kontrakt PostgreSQL, rozszerzony o `TicketCounter`, `blocksWork`, `contact`, `department` i poprawione relacje artykulow FAQ.
- Dodano testy jednostkowe dla domeny email, permissions i numeracji ticketow.

Do zbudowania:

- Widok szczegolow ticketu i kolejki IT.
- Pelny routing portalu oraz panelu IT.
- Uruchomienie walidacji po instalacji zaleznosci.

## Etap 3 - Docker dla lokalnego developmentu

Status: zrobione.

Zrobione:

- Uznano Docker za najlepszy domyslny tryb lokalny dla projektu, bo repo ma docelowo pracowac z PostgreSQL, a srodowisko Windows/WSL moze komplikowac lokalne `npm install`.
- Dodano `Dockerfile` dla produkcyjnego buildu Next.js.
- Dodano `docker-compose.yml` z serwisami `app` i `postgres`.
- Aplikacja w Docker Compose startuje na porcie `3001`, zeby uniknac konfliktu z innymi uslugami na porcie `3000`.
- PostgreSQL w Docker Compose jest dostepny na porcie hosta `5433`.
- Dodano `.dockerignore`.
- Dodano dokument `docker-development.md`.
- Zaktualizowano `README.md` o rekomendowany start przez Docker.

Do zbudowania:

- Podlaczenie runtime aplikacji do Prisma/PostgreSQL zamiast lokalnego JSON-store.
- Walidacja `docker compose up` po pobraniu obrazow i zaleznosci.

## Etap 4 - Widoki MVP

Status: zrobione.

Zrobione:

- Dodano routing App Router dla `/`, `/login`, `/tickets`, `/tickets/new`, `/tickets/[id]`, `/admin/tickets`, `/admin/tickets/[id]`.
- Dodano portal zglaszajacego: lista widocznych zgloszen, filtrowanie po statusie, formularz nowego zgloszenia i szczegoly ticketu.
- Dodano panel IT: kolejka wszystkich ticketow dla `AGENT` i `ADMIN`, metryki, filtry statusu/priorytetu/assignee i widok szczegolow.
- Dodano akcje IT w szczegolach: zmiana statusu, priorytetu i wykonawcy.
- Dodano komentarze publiczne oraz notatki wewnetrzne widoczne tylko dla IT.
- Dodano timeline zdarzen oraz podstawowe logi powiadomien email w warstwie danych.
- Dodano responsive layout i dark mode dla ekranow MVP.

Do zbudowania:

- Prawdziwa wysylka email przez Resend/SMTP.
- Zalaczniki do ticketow.
- FAQ z wyszukiwarka i CRUD admina.
- CRUD uzytkownikow, sklepow i kategorii.
- Raporty i SLA.

## Etap 5 - Walidacja i uruchomienie

Status: zrobione.

Zrobione:

- Zainstalowano zaleznosci i wygenerowano `package-lock.json`.
- Uruchomiono `npm run typecheck` - OK.
- Uruchomiono `npm run test` - OK, 7 testow w 3 plikach.
- Uruchomiono `npm run lint` - OK.
- Uruchomiono `npm run build` poza sandboxem - OK. Build w sandboxie blokowal sie na probie odpalenia `npm config get registry` przez Next podczas patchowania lockfile SWC.
- Uruchomiono `docker compose config` - OK.
- Uruchomiono `docker compose up -d` - OK. Kontenery `fixit-app-1` i `fixit-postgres-1` dzialaja.
- Sprawdzono `http://localhost:3001/login` przez `curl -I` - OK, `HTTP/1.1 200 OK`.

Do zbudowania:

- Migracja runtime z JSON-store na Prisma/PostgreSQL.
- Testy e2e dla loginu, tworzenia ticketu, panelu IT i widocznosci notatek wewnetrznych.
- Obsluga audytu podatnosci npm. Aktualnie `npm audit` raportuje 7 moderate severity vulnerabilities w zaleznosciach developerskich/runtime; nie zastosowano `npm audit fix --force`, bo mogloby wprowadzic breaking changes.

## Etap 6 - Zakladanie kont (magic link) i powiadomienia email

Status: zrobione.

Zrobione:

- Dodano warstwe email `lib/email.ts` z abstrakcja `sendEmail`. Gdy ustawiony `RESEND_API_KEY`, maile ida przez Resend (REST API, bez dodatkowej zaleznosci); w przeciwnym razie fallback loguje maila do konsoli, zeby development dzialal bez konta Resend.
- Dodano szablony maili `lib/email-templates.ts` per case: potwierdzenie konta / link do logowania, ticket utworzony (zglaszajacy), nowy ticket w kolejce (IT), przypisanie wykonawcy, nowy komentarz publiczny, ticket rozwiazany. Tresc z danych uzytkownika jest escape'owana w HTML.
- Zastapiono natychmiastowe logowanie przeplywem magic link: `lib/magic-link.ts` (token, TTL, walidacja), tokeny w JSON-store, server action wysylajacy link i route handler `app/auth/verify` aktywujacy konto i ustawiajacy sesje.
- Zakladanie kont z potwierdzeniem email: pierwsze klikniecie w link zaklada aktywne konto REPORTER dla adresu `@bagietka.pl`; kolejne logowania uzywaja tego samego mechanizmu.
- Podlaczono realne powiadomienia do zdarzen ticketow (utworzenie, przypisanie, komentarz publiczny, rozwiazanie) z zapisem statusu `SENT`/`FAILED` w `notification_logs`. Bledy wysylki nie przerywaja glownej operacji.
- Zaktualizowano `.env.example`, `docker-compose.yml`, `README.md` o `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, `MAGIC_LINK_TTL_MINUTES`.
- Dodano testy: walidacja tokenow magic link i renderowanie szablonow maili. `npm run lint`, `npm run typecheck`, `npm run test` (15 testow) oraz `npm run build` - OK.

Do zbudowania:

- Realna weryfikacja domeny nadawcy w Resend i podlaczenie produkcyjnego `RESEND_API_KEY` (przy deployu na Railway).
- Migracja runtime z JSON-store na Prisma/PostgreSQL (tokeny magic link i notification logs przeniesc do bazy).
- Rate limit dla wysylki linkow logowania i audit log zmian rol/statusow.

Pelna lista otwartych zadan na przyszle sesje jest w `remaining_tasks.md` (root repo).

## Etap 7 - Testy E2E magic link i powiadomien (na logach)

Status: zrobione.

Testowane lokalnie (`npm run dev`, JSON-store, swieze `.data`). Bez `RESEND_API_KEY` - maile lecialy do logu serwera (fallback z `lib/email.ts`); realna wysylka Resend nie byla testowana w tej sesji (zostaje na deploy na Railway). Wszystkie 5 testow przeszlo, brak bugow.

Zweryfikowano:

- Nowy adres `@bagietka.pl` -> panel "Sprawdz skrzynke", a nie natychmiastowe logowanie. W logu link z tematem "Potwierdz konto FixIT" i `…/auth/verify?token=<64 hex>`.
- Klikniecie linku -> redirect na `/tickets`, zalogowany jako REPORTER; w DB konto `isActive:true`, token ma `usedAt`.
- Link jednorazowy: ponowne uzycie -> `/login?status=used`, baner "Ten link zostal juz uzyty…", brak logowania.
- Restrykcja domeny: `intruder@gmail.com` -> baner bledu, zero wpisow email w logu.
- Utworzenie ticketu `IT-2026-0004` -> 3 powiadomienia (zglaszajacy + 2x IT) zapisane w `notification_logs` ze statusem `SENT` (nie `QUEUED`).
- Drugi request linku dla istniejacego konta uzyl tematu "Link do logowania FixIT" (galaz `isNewAccount` dziala).

Uwaga operacyjna (merge):

- `main` dostal commit konwertujacy pliki na konce linii CRLF, co wywolalo pozorne konflikty w 13 plikach. Rozwiazane przez `git merge origin/main -Xignore-all-space` - konflikty czysto whitespace'owe zniknely, kod funkcjonalny bez zmian. Po merge: `npm run lint`, `npm run typecheck`, `npm run test` (15), `npm run build` - OK.

## Etap 8 - Prisma w Docker Compose

Status: zrobione (z gałęzi `main`, commit `codex fix2`).

Zrobione:

- Dodano Prisma CLI i `@prisma/client` w kompatybilnej linii 6.x.
- Dodano startowa migracje Prisma w `prisma/migrations`.
- Dodano idempotentny seed Prisma w `prisma/seed.mjs`, oparty o te same dane testowe co lokalny JSON-store.
- Dodano skrypty `db:generate`, `db:migrate:deploy` i `db:seed`.
- Dodano jednorazowe uslugi `migrate` i `seed` w `docker-compose.yml`, uruchamiane po starcie PostgreSQL i przed aplikacja.

Do zbudowania:

- Zobacz aktualna liste w `remaining_tasks.md` (root) oraz `docs/it-helpdesk-docs/remaining-tasks.md`.
