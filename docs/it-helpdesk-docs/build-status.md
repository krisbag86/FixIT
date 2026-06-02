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

## Etap 6 - Prisma w Docker Compose

Status: zrobione.

Zrobione:

- Dodano Prisma CLI i `@prisma/client` w kompatybilnej linii 6.x.
- Dodano startowa migracje Prisma w `prisma/migrations`.
- Dodano idempotentny seed Prisma w `prisma/seed.mjs`, oparty o te same dane testowe co lokalny JSON-store.
- Dodano skrypty `db:generate`, `db:migrate:deploy` i `db:seed`.
- Dodano jednorazowe uslugi `migrate` i `seed` w `docker-compose.yml`, uruchamiane po starcie PostgreSQL i przed aplikacja.

Do zbudowania:

- Zobacz aktualna liste w `remaining-tasks.md`.
