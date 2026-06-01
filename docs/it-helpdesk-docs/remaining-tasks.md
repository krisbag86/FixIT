# Remaining Tasks - FixIT Helpdesk

Aktualna lista prac pozostalych po Etapie 6, czyli po dodaniu migracji i seeda Prisma uruchamianych w Docker Compose.

## Decyzje zakresowe

- Migracja runtime aplikacji z lokalnego JSON-store na Prisma/PostgreSQL zostaje na etap deploymentu na Railway.
- Do tego czasu aplikacja MVP nadal czyta i zapisuje dane w `.data/fixit-db.json`.
- PostgreSQL w Docker Compose jest przygotowywany migracjami i seedem jako docelowa baza dla kolejnego etapu.

## Zrobione (po Etapie 6)

- Priorytet 3 (Email) zostal zrealizowany: prawdziwa wysylka maili, szablony oraz aktualizacja `NotificationLog` na `SENT`/`FAILED`.
- Priorytet 4 (Audyt npm) zostal zrealizowany: `npm audit` jest czysty.

## Priorytet 1 - Railway i runtime PostgreSQL

Cel: przygotowac aplikacje do produkcyjnego uruchomienia na Railway z PostgreSQL jako glowna baza.

Do zrobienia:

- Granice warstwy danych:
  - Zdecydowac i opisac podejscie: osobna warstwa repozytorium (rekomendowane) vs bezposrednia podmiana `lib/data-store.ts`.
- Przejscie runtime na PostgreSQL (Prisma Client):
  - Podmienic odczyty dla Users/Stores/Categories (najpierw read-only).
  - Podmienic Tickets/Comments/TicketEvent/NotificationLog na operacje Prisma (sciezki zapisu), zachowujac obecne reguly permissions i widocznosci ticketow.
  - Upewnic sie, ze wszystkie dotychczasowe akcje serwerowe dzialaja na DB bez zmian UX.
- Numeracja ticketow:
  - Przeniesc alokacje numeru na `TicketCounter` z transakcja.
  - Zagwarantowac brak duplikatow przy rownoleglych utworzeniach ticketu.
- Trwalosc zdarzen i powiadomien:
  - Upewnic sie, ze `TicketEvent` zapisuje sie dla wszystkich obecnych typow zdarzen.
  - Upewnic sie, ze `NotificationLog` jest zgodny ze stanami i timestampami uzywanymi przez runtime.
- Railway:
  - Skonfigurowac env vars: `DATABASE_URL`, `APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_FROM`.
  - Uruchamiac `npm run db:migrate:deploy` podczas deploymentu.
  - Ustalic polityke seedowania produkcji, zeby seed testowy nie tworzyl danych na produkcji.

Walidacja:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run db:migrate:deploy` na bazie Railway
- smoke test: logowanie + utworzenie ticketu + przypisanie/status + komentarz na staging/production

## Priorytet 2 - Testy e2e

Cel: zabezpieczyc pionowy MVP automatycznymi testami end-to-end.

Do zrobienia:

- Fundament e2e:
  - Wybrac runner (Playwright rekomendowany) i skonfigurowac go w repo.
  - Dodac skrypt `npm run test:e2e`.
  - Ustalic deterministyczna strategie danych (seed/fixtures) dobra dla CI.
- Auth:
  - Logowanie domena `bagietka.pl`.
  - Odrzucenie obcej domeny.
- Sciezka reportera:
  - Utworzenie ticketu i widocznosc na `/tickets`.
  - Wejscie w szczegoly ticketu i dodanie komentarza publicznego.
- Sciezka IT:
  - Wejscie agenta/admina na `/admin/tickets`.
  - Przypisanie ticketu oraz zmiana statusu i priorytetu.
- Regresja uprawnien:
  - Brak widocznosci notatek wewnetrznych dla reportera.

Walidacja:

- `npm run test:e2e`

## Priorytet 5 - Zalaczniki

Cel: pozwolic reporterom i IT dolaczac pliki do ticketow lub komentarzy.

Do zrobienia:

- Storage:
  - Wybrac i opisac storage dla plikow (lokalnie, S3/R2 lub Railway volume) oraz zasady retencji.
- Backend:
  - Dodac endpoint upload z limitami rozmiaru i typow plikow.
  - Zapisywac metadane w `TicketAttachment` (nazwa, rozmiar, content-type, autor, timestamp).
  - Zabezpieczyc pobieranie zgodnie z `canViewTicket`.
- UI:
  - Dodac upload w formularzu ticketu.
  - Dodac upload w formularzu komentarza.
  - Pokazac zalaczniki w widoku ticketu.

Walidacja:

- testy jednostkowe/autoryzacyjne dla upload/download
- test reczny: upload + pobranie jako reporter i jako IT (ticket widoczny / niewidoczny)

## Priorytet 6 - FAQ / baza wiedzy

Cel: uruchomic publiczna baze wiedzy i panel zarzadzania artykulami.

Do zrobienia:

- Reader:
  - Dodac widok listy artykulow dla zalogowanych uzytkownikow.
  - Dodac wyszukiwarke i filtrowanie po kategorii.
  - Dodac widok artykulu.
- Admin:
  - Dodac CRUD artykulow.
  - Dodac publikacje/ukrywanie artykulow.
- Opcjonalnie:
  - Pokazac sugestie FAQ w formularzu nowego ticketu po wyborze kategorii.

Walidacja:

- smoke test: lista + wyszukiwanie + otwarcie artykulu (zalogowany uzytkownik)
- smoke test: admin CRUD + publish/unpublish
- sprawdzenie uprawnien (brak panelu admin dla roli nie-admin)

## Priorytet 7 - Admin CRUD

Cel: dac adminom zarzadzanie podstawowymi slownikami systemu.

Do zrobienia:

- Uzytkownicy:
  - Lista/wyszukiwanie uzytkownikow.
  - Dezaktywacja/reaktywacja.
  - Przypisywanie rol.
- Slowniki:
  - CRUD sklepow.
  - CRUD kategorii.
- Audit:
  - Audit log zmian roli i uprawnien.

Walidacja:

- smoke test: admin-only routing (role gate)
- testy/regresja: zmiana roli nie psuje `permissions` i widocznosci ticketow

## Priorytet 8 - Raporty i SLA

Cel: dodac widoki kontrolingowe dla IT i administracji.

Do zrobienia:

- Metryki MVP:
  - Liczba otwartych ticketow.
  - Tickety krytyczne.
  - Sredni czas rozwiazania.
  - Top kategorie.
- SLA MVP:
  - Podstawowe reguly SLA dla priorytetow.
  - Tickety po SLA (oznaczenie i widok).
- Eksport:
  - Eksport CSV dla listy/reportu.

Walidacja:

- weryfikacja wynikow na znanym zbiorze danych (seed) i porownanie z zapytaniami/wyliczeniami
- smoke test: eksport CSV i otwarcie w arkuszu

## Znane ograniczenia srodowiska

- W aktualnym srodowisku Codex nie byl dostepny Docker CLI, wiec `docker compose config` i `docker compose up` po Etapie 6 wymagaja walidacji na maszynie z Dockerem.
- `npm run build` przechodzi, ale Next.js pokazuje ostrzezenie o braku pluginu Next w konfiguracji ESLint.
- Prisma 6.x jest celowo uzyta dla zgodnosci z obecnym `schema.prisma`; przy przejsciu na Prisma 7 trzeba przeniesc konfiguracje seeda z `package.json#prisma` do `prisma.config.ts`.
