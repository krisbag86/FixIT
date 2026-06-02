# Remaining Tasks - FixIT Helpdesk

Aktualna lista prac pozostalych po Etapie 7, czyli po dodaniu runtime data-store dla Prisma/PostgreSQL oraz stabilnej paczki testow e2e Playwright.

## Decyzje zakresowe

- Runtime aplikacji korzysta z jednego publicznego API `lib/data-store.ts`.
- Lokalnie i w testach domyslnym storage pozostaje `.data/fixit-db.json`.
- Prisma/PostgreSQL jest wlaczane przez `FIXIT_DATA_PROVIDER=prisma`, albo automatycznie w produkcji, gdy istnieje `DATABASE_URL` i nie ustawiono `FIXIT_DATA_PROVIDER=json`.
- JSON-store ma kolejke zapisow w procesie aplikacji, zeby backgroundowe aktualizacje powiadomien nie nadpisywaly rownoleglych zmian.

## Zrobione (po Etapie 7)

- Priorytet 3 (Email) zostal zrealizowany: prawdziwa wysylka maili, szablony oraz aktualizacja `NotificationLog` na `SENT`/`FAILED`.
- Priorytet 4 (Audyt npm) zostal zrealizowany: `npm audit` jest czysty.
- Priorytet 1 (Railway/runtime PostgreSQL) zostal zrealizowany po stronie kodu:
  - `Users`, `Stores`, `Categories`, `Tickets`, `Comments`, `TicketEvent` i `NotificationLog` maja runtime Prisma w `lib/data-store.ts`.
  - Numeracja ticketow w trybie Prisma korzysta z `TicketCounter` w transakcji.
  - Zdarzenia i powiadomienia sa tworzone w tych samych sciezkach zapisu co w JSON-store.
  - Do walidacji produkcyjnej zostaje uruchomienie migracji i smoke test na prawdziwej bazie Railway.
- Priorytet 2 (Testy e2e) zostal zrealizowany:
  - Playwright jest skonfigurowany w repo, a `npm run test:e2e` przechodzi lokalnie.
  - Testy obejmuja logowanie domenowe, odrzucenie obcych domen, tworzenie ticketu, liste ticketow, panel IT, przypisanie/status oraz regresje notatek wewnetrznych.
  - E2e uruchamia dev server z wylaczonym SMTP, zeby testy nie wykonywaly realnych prob wysylki.
- Priorytet 6 (FAQ / baza wiedzy) zostal zrealizowany:
  - `lib/data-store.ts`: `listPublishedKnowledgeArticles` (z wyszukiwaniem i filtrem kategorii), `listKnowledgeArticles`, `findKnowledgeArticleBySlug`, `findKnowledgeArticleById`, `createKnowledgeArticle`, `updateKnowledgeArticle`, `deleteKnowledgeArticle` — oba runtimes (JSON + Prisma).
  - `lib/types.ts`: rozszerzony `KnowledgeArticle` o `createdById`/`updatedById`.
  - `app/actions.ts`: `createKnowledgeArticleAction`, `updateKnowledgeArticleAction`, `deleteKnowledgeArticleAction` z walidacja Zod i uprawnieniami `admin:manage-faq`.
  - Czytelnik: `/knowledge` (lista + wyszukiwarka + filtrowanie po kategorii), `/knowledge/[slug]` (widok artykulu).
  - Admin: `/admin/knowledge` (tabela + status publikacji + usuniecie), `/admin/knowledge/new` (formularz), `/admin/knowledge/[id]` (edycja).
  - `components/knowledge/article-card.tsx`, `article-detail.tsx`, `article-form.tsx`, `ticket-form-faq.tsx`.
  - `components/app-shell.tsx`: link "Baza wiedzy" w nawigacji (desktop + mobile).
  - `app/tickets/new/page.tsx`: sekcja sugestii FAQ ponad przyciskiem submit.
  - `lib/seed.ts`: 6 artykulow seedowych (publikowane + niepublikowane).
  - Walidacja: `npm run lint` OK, `npm run typecheck` OK, `npm run test` 18 passed / 1 skipped.

## Walidacja Etapu 7 + Priorytet 6

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run test` - OK, 18 passed / 1 skipped
- `npm run test:e2e` - OK, 19 passed (przed zmianami priorytetu 6)
- `npm run build` - OK po zmianach runtime, po uruchomieniu poza sandboxem; finalny rerun po ostatnich poprawkach e2e nie zostal wykonany, bo approval system odrzucil kolejne uruchomienie poza sandboxem.

## Pozostale zadania deploymentowe Railway

- Skonfigurowac env vars: `DATABASE_URL`, `APP_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_FROM`, `FIXIT_DATA_PROVIDER=prisma`.
- Uruchamiac `npm run db:migrate:deploy` podczas deploymentu.
- Ustalic polityke seedowania produkcji, zeby seed testowy nie tworzyl danych na produkcji.
- `npm run db:migrate:deploy` na bazie Railway
- Smoke test: logowanie + utworzenie ticketu + przypisanie/status + komentarz na staging/production.

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

## Priorytet 6 - FAQ / baza wiedzy [ZROBIONE]

Zrealizowane:

- **Reader:**
  - `/knowledge` — lista artykulow z wyszukiwarka (`?q=`) i filtrowaniem po kategorii (`?category=`).
  - `/knowledge/[slug]` — widok pojedynczego artykulu.
- **Admin:**
  - `/admin/knowledge` — tabela artykulow z statusami (publikowany/ukryty), przyciskami edycji i usuniecia.
  - `/admin/knowledge/new` — formularz tworzenia (tytul, slug, kategoria, tresc, publikacja).
  - `/admin/knowledge/[id]` — formularz edycji z ukrytym `id`.
  - Usuwanie z potwierdzeniem (confirm dialog).
- **Opcjonalnie:**
  - Sugestie FAQ w formularzu nowego ticketu — lista artykulow z kategoriami, link do bazy wiedzy.
- **Dane:**
  - 6 artykulow seedowych (5 publikowanych, 1 ukryty) w roznych kategoriach.

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
