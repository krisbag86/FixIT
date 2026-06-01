# Remaining Tasks - FixIT Helpdesk

Aktualna lista prac pozostalych po Etapie 6, czyli po dodaniu migracji i seeda Prisma uruchamianych w Docker Compose.

## Decyzje zakresowe

- Migracja runtime aplikacji z lokalnego JSON-store na Prisma/PostgreSQL zostaje na etap deploymentu na Railway.
- Do tego czasu aplikacja MVP nadal czyta i zapisuje dane w `.data/fixit-db.json`.
- PostgreSQL w Docker Compose jest przygotowywany migracjami i seedem jako docelowa baza dla kolejnego etapu.

## Priorytet 1 - Railway i runtime PostgreSQL

Cel: przygotowac aplikacje do produkcyjnego uruchomienia na Railway z PostgreSQL jako glowna baza.

Do zrobienia:

- Przepisac warstwe danych z `lib/data-store.ts` na Prisma Client.
- Zachowac obecne reguly permissions i widocznosci ticketow.
- Przeniesc numeracje ticketow na `TicketCounter` z transakcja.
- Upewnic sie, ze event log i notification log sa zapisywane w PostgreSQL.
- Ustalic polityke seedowania produkcji, zeby seed testowy nie tworzyl przypadkowych danych na produkcji.
- Skonfigurowac Railway env vars: `DATABASE_URL`, `APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_FROM` i docelowy provider email.
- Uruchamiac `npm run db:migrate:deploy` podczas deploymentu.

Walidacja:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run db:migrate:deploy` na bazie Railway
- smoke test logowania i tworzenia ticketu na staging/production

## Priorytet 2 - Testy e2e

Cel: zabezpieczyc pionowy MVP automatycznymi testami end-to-end.

Do zrobienia:

- Dodac Playwright albo inny runner e2e.
- Dodac skrypt `npm run test:e2e`.
- Pokryc logowanie domena `bagietka.pl`.
- Pokryc odrzucenie obcej domeny.
- Pokryc tworzenie ticketu.
- Pokryc panel IT: wejscie agenta/admina, przypisanie, zmiana statusu.
- Pokryc brak widocznosci notatek wewnetrznych dla reportera.

Walidacja:

- `npm run test:e2e`

## Priorytet 3 - Email

Cel: zastapic obecne logi `QUEUED` prawdziwa wysylka maili.

Do zrobienia:

- Wybrac provider: Resend, SMTP albo firmowy provider.
- Dodac abstrakcje `sendEmail`.
- Dodac szablony maili dla utworzenia ticketu, przypisania, komentarza publicznego i rozwiazania.
- Aktualizowac `NotificationLog` statusem `SENT` albo `FAILED`.
- Upewnic sie, ze blad maila nie przerywa glownej operacji ticketowej.

Walidacja:

- testy jednostkowe dla obslugi sukcesu i bledu wysylki,
- test reczny lub e2e w stagingu z testowym odbiorca.

## Priorytet 4 - Audyt npm

Cel: swiadomie obsluzyc raportowane podatnosci bez wymuszonego breaking upgrade.

Do zrobienia:

- Uruchomic `npm audit`.
- Rozdzielic podatnosci runtime od dev-only.
- Zastosowac bezpieczne aktualizacje bez `--force`, jesli sa dostepne.
- Dla pozostalych wpisac decyzje: upgrade pozniej, akceptacja ryzyka albo wymiana zaleznosci.

Walidacja:

- `npm audit`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Priorytet 5 - Zalaczniki

Cel: pozwolic reporterom i IT dolaczac pliki do ticketow lub komentarzy.

Do zrobienia:

- Wybrac storage dla plikow.
- Dodac upload w formularzu ticketu i komentarza.
- Zapisywac metadane w `TicketAttachment`.
- Dodac limity rozmiaru i typow plikow.
- Pokazac zalaczniki w widoku ticketu.
- Zabezpieczyc dostep zgodnie z `canViewTicket`.

## Priorytet 6 - FAQ / baza wiedzy

Cel: uruchomic publiczna baze wiedzy i panel zarzadzania artykulami.

Do zrobienia:

- Dodac widok listy artykulow dla zalogowanych uzytkownikow.
- Dodac wyszukiwarke i filtrowanie po kategorii.
- Dodac widok artykulu.
- Dodac admin CRUD artykulow.
- Dodac publikacje/ukrywanie artykulow.
- Opcjonalnie pokazac sugestie FAQ w formularzu nowego ticketu po wyborze kategorii.

## Priorytet 7 - Admin CRUD

Cel: dac adminom zarzadzanie podstawowymi slownikami systemu.

Do zrobienia:

- CRUD uzytkownikow.
- CRUD sklepow.
- CRUD kategorii.
- Dezaktywacja uzytkownikow.
- Przypisywanie rol.
- Audit log zmian roli i uprawnien.

## Priorytet 8 - Raporty i SLA

Cel: dodac widoki kontrolingowe dla IT i administracji.

Do zrobienia:

- Liczba otwartych ticketow.
- Tickety krytyczne.
- Tickety po SLA.
- Sredni czas rozwiazania.
- Top kategorie.
- Eksport CSV.
- Podstawowe reguly SLA dla priorytetow.

## Znane ograniczenia srodowiska

- W aktualnym srodowisku Codex nie byl dostepny Docker CLI, wiec `docker compose config` i `docker compose up` po Etapie 6 wymagaja walidacji na maszynie z Dockerem.
- `npm run build` przechodzi, ale Next.js pokazuje ostrzezenie o braku pluginu Next w konfiguracji ESLint.
- Prisma 6.x jest celowo uzyta dla zgodnosci z obecnym `schema.prisma`; przy przejsciu na Prisma 7 trzeba przeniesc konfiguracje seeda z `package.json#prisma` do `prisma.config.ts`.
