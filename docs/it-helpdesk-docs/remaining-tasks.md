# Remaining Tasks - FixIT Helpdesk

Aktualna lista prac pozostalych po Etapie 7, czyli po dodaniu runtime data-store dla Prisma/PostgreSQL oraz stabilnej paczki testow e2e Playwright.

## Decyzje zakresowe

- Runtime aplikacji korzysta z jednego publicznego API `lib/data-store.ts`.
- Lokalnie i w testach domyslnym storage pozostaje `.data/fixit-db.json`.
- Prisma/PostgreSQL jest wlaczane przez `FIXIT_DATA_PROVIDER=prisma`, albo automatycznie w produkcji, gdy istnieje `DATABASE_URL` i nie ustawiono `FIXIT_DATA_PROVIDER=json`.
- JSON-store ma kolejke zapisow w procesie aplikacji, zeby backgroundowe aktualizacje powiadomien nie nadpisywaly rownoleglych zmian.

## Zrobione (po Etapie 7)

- Priorytet 3 (Email) zostal zrealizowany: prawdziwa wysylka maili przez Brevo API na Railway, fallback SMTP, szablony oraz aktualizacja `NotificationLog` na `SENT`/`FAILED`.
- Priorytet 4 (Audyt npm) zostal zrealizowany: `npm audit` jest czysty.
- Priorytet 1 (Railway/runtime PostgreSQL) zostal zrealizowany po stronie kodu:
  - `Users`, `Stores`, `Categories`, `Tickets`, `Comments`, `TicketEvent` i `NotificationLog` maja runtime Prisma w `lib/data-store.ts`.
  - Numeracja ticketow w trybie Prisma korzysta z `TicketCounter` w transakcji.
  - Zdarzenia i powiadomienia sa tworzone w tych samych sciezkach zapisu co w JSON-store.
  - Produkcyjny deploy na Railway z `main` zostal zweryfikowany 2026-06-09.
- Priorytet 2 (Testy e2e) zostal zrealizowany:
  - Playwright jest skonfigurowany w repo, a `npm run test:e2e` przechodzi lokalnie.
  - Testy obejmuja logowanie domenowe, odrzucenie obcych domen, tworzenie ticketu, liste ticketow, panel IT, przypisanie/status oraz regresje notatek wewnetrznych.
  - E2e uruchamia dev server z wylaczona wysylka email, zeby testy nie wykonywaly realnych prob wysylki.
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
- Priorytet 5 (Zalaczniki) zostal zrealizowany:
  - **Storage**: lokalny filesystem w `.data/attachments/{uuid}` — zdecentralizowana sciezka, plik klucza to uuid, nazwa pliku przechowywana w metadanych. Limity: 10 MB / plik, dozwolone typy: `image/*`, `text/*`, `application/pdf`, `application/json`. Pliki binarne (`octet-stream`) i nieznane typy blokowane walidacja.
  - `lib/storage-utils.ts`: czyste utilsy (limit, mime-type, walidacja klucza, formatowanie rozmiaru) — testowalne bez `server-only`.
  - `lib/storage.ts`: server-only operacje I/O (`saveAttachmentFile`, `readAttachmentFile`, `deleteAttachmentFile`).
  - `prisma/schema.prisma`: `TicketAttachment` z polami `uploadedById` (nullable, `SetNull` on delete) i indeksami `ticketId` / `commentId`. Relacja `User.attachments`.
  - `lib/data-store.ts`: `mapAttachment`, `listAttachments`, `findAttachment`, `createAttachment`, `deleteAttachment` — oba runtimes (JSON + Prisma). W `readDatabase` pobierane rownolegle z innymi kolekcjami.
  - `app/api/attachments/ticket/[ticketId]/route.ts`: `POST` upload — autoryzacja (`requireUser` + `canViewTicket`), walidacja rozmiaru/mime/filename, zwraca JSON z `id`, `filename`, `mimeType`, `size`, `createdAt`.
  - `app/api/attachments/[id]/route.ts`: `GET` download — autoryzacja (`canViewTicket`), walidacja klucza sciezki, odczyt binarny, `Content-Disposition: inline` z nazwa.
  - `components/tickets/attachment-upload.tsx`: klient komponent z multi-file uploadem, statusami per-plik (pending/uploading/done/error), lista z linkami do pobrania. `readOnly` mode dla przyszlego uzycia.
  - `components/ticket-detail.tsx`: wbudowany `AttachmentUpload` pod opisem ticketu (widoczny rowniez w widoku admina).
  - `app/tickets/[id]/page.tsx` + `app/admin/tickets/[id]/page.tsx`: rownolegle pobieranie `listAttachments` i przekazanie do `TicketDetail`.
  - `lib/seed.ts`: pusta tablica `attachments: []` (wymagana przez typ `Database`).
  - Bezpieczenstwo: `canViewTicket` wymusza widocznosc ticketu przy upload i download. `isValidStorageKey` chroni przed `..` i path-traversal.
  - Walidacja: `npm run lint` OK, `npm run typecheck` OK, `npm run test` 29 passed / 1 skipped.
- Priorytet 7 (Admin CRUD) zostal zrealizowany:
  - `app/admin/users`, `app/admin/stores`, `app/admin/categories` z role gate dla `ADMIN`.
  - `app/admin/actions.ts`: server actions dla zarzadzania uzytkownikami, sklepami i kategoriami z walidacja Zod.
  - `components/admin/admin-nav.tsx`: wspolna nawigacja sekcji administracyjnych, podpieta do panelu ticketow i bazy wiedzy.
  - `lib/data-store.ts`: `listUsersAdmin`, `listStoresAdmin`, `listCategoriesAdmin`, `listAdminAuditLogs`, `updateUserAdmin`, `create/update/deleteStoreAdmin`, `create/update/deleteCategoryAdmin` — oba runtimes (JSON + Prisma).
  - `lib/admin-utils.ts`: czyste reguly audytu i blokad usuwania slownikow.
  - `prisma/schema.prisma` + migracja `20260602025819_admin_audit_log`: nowy `AdminAuditLog` dla zmian roli, aktywnosci i CRUD slownikow.
  - Bezpieczenstwo:
    - blokada odebrania ostatniego aktywnego administratora,
    - blokada zdezaktywowania/zmiany roli wlasnego konta admina,
    - blokada usuniecia sklepu/kategorii, jesli sa powiazane z danymi runtime.
  - Walidacja: `npm run db:generate` OK, `npm run lint` OK, `npm run typecheck` OK, `npm run test` OK, 32 passed / 1 skipped.
- Auth / onboarding uzytkownikow zostaly rozszerzone:
  - publiczna rejestracja `/register` dla adresow w domenie `bagietka.pl`,
  - self-registration tworzy konto `REPORTER` i od razu loguje do aplikacji,
  - `/admin/users` pozwala utworzyc konto recznie i opcjonalnie wyslac jednorazowy link aktywacyjny e-mailem,
  - konta tworzone przez admina maja wymuszona zmiane hasla przy pierwszym logowaniu.
- Aktualizacja 2026-06-22:
  - runtime Node zostal przypiety do `20.20.2` w `Dockerfile`, `docker-compose.yml`, `.nvmrc`, `.node-version` i `package.json#engines`,
  - Railway pozostaje na `DOCKERFILE` builderze z `railway.json`; nie trzeba ustawiac `RAILPACK_NODE_VERSION`,
  - adminowski onboarding uzywa jednorazowych linkow aktywacyjnych zamiast wysylania hasla,
  - gdy provider email nie dziala, `/admin/users` pokazuje awaryjny link aktywacyjny,
  - przycisk `Link` w tabeli uzytkownikow regeneruje token i ponawia wysylke dla aktywnych kont z `mustChangePassword=true`.
  - przycisk `Usuń` usuwa tylko konta bez historii; konta z powiazanymi ticketami/komentarzami/trescia trzeba dezaktywowac.
  - wysylka na Railway uzywa Brevo API przez `BREVO_API_KEY`; SMTP zostaje jako fallback, ale moze timeoutowac.

## Walidacja Etapu 7 + Priorytet 6 + Priorytet 5

- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run test` - OK, 29 passed / 1 skipped (po dodaniu 11 testow storage)
- `npm run test:e2e` - OK, 19 passed (przed zmianami priorytetu 6)
- `npm run build` - OK po zmianach runtime, po uruchomieniu poza sandboxem; finalny rerun po ostatnich poprawkach e2e nie zostal wykonany, bo approval system odrzucil kolejne uruchomienie poza sandboxem.

## Pozostale zadania deploymentowe Railway

- Skonfigurowac env vars: `DATABASE_URL`, `APP_URL`, `BREVO_API_KEY`, zweryfikowany `EMAIL_FROM`, `FIXIT_DATA_PROVIDER=prisma`.
- Ustalic polityke seedowania produkcji, zeby seed testowy nie tworzyl danych na produkcji.
- Po merge do `main` sprawdzic Railway build log pod katem obrazu `node:20.20.2-bookworm-slim`.
- SMTP nie jest wymagane na Railway, jesli dziala `BREVO_API_KEY`. Awaryjny link aktywacyjny w `/admin/users` zostaje fallbackiem przy problemach z providerem email.
- Smoke test po kolejnych zmianach: logowanie + rejestracja + utworzenie ticketu + przypisanie/status + komentarz na staging/production.

## Priorytet 5 - Zalaczniki [ZROBIONE]

Zrealizowane:

- **Storage:** lokalny filesystem w `.data/attachments/{uuid}`. Limity 10 MB na plik, dozwolone typy: `image/*`, `text/*`, `application/pdf`, `application/json`. Pliki binarne (`octet-stream`) i nieznane typy blokowane.
- **Backend:**
  - `POST /api/attachments/ticket/[ticketId]` — upload z autoryzacja `canViewTicket` i walidacja mime/size/filename.
  - `GET /api/attachments/[id]` — download z autoryzacja `canViewTicket` i walidacja klucza sciezki (ochrona przed path-traversal).
  - `TicketAttachment` z `uploadedById`, `commentId?`, indeksami `ticketId` i `commentId`. Relacja z `User` (`SetNull` on delete).
- **UI:**
  - `AttachmentUpload` w `components/tickets/attachment-upload.tsx` — multi-file upload, statusy per-plik, lista z linkami do pobrania.
  - Wbudowany w `TicketDetail` (widok reportera i admina) — widoczny rowniez dla obu rol.
- **Dane:**
  - `lib/data-store.ts`: `listAttachments`, `findAttachment`, `createAttachment`, `deleteAttachment` — oba runtimes (JSON + Prisma).
  - `lib/seed.ts`: pusta tablica `attachments: []`.
- **Bezpieczenstwo:**
  - `canViewTicket` wymusza widocznosc ticketu przy upload i download.
  - `isValidStorageKey` chroni przed `..` i path-traversal.
- **Testy:**
  - `tests/storage.test.ts` — 11 testow (validation key, mime types, file size formatting, error class).

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

## Priorytet 7 - Admin CRUD [ZROBIONE]

Zrealizowane:

- Uzytkownicy:
  - Lista i wyszukiwarka uzytkownikow.
  - Dezaktywacja/reaktywacja.
  - Przypisywanie rol, sklepu i dzialu.
  - Tworzenie nowego konta przez admina.
  - Generowanie jednorazowego linku aktywacyjnego i opcjonalna wysylka e-mailem przez Brevo API.
- Slowniki:
  - CRUD sklepow z blokada usuniecia przy aktywnych powiazaniach.
  - CRUD kategorii z blokada usuniecia przy aktywnych powiazaniach.
- Audit:
  - `AdminAuditLog` dla zmian roli, aktywnosci, sklepow i kategorii.
  - Widok ostatnich zmian w `/admin/users`.
- Nawigacja:
  - Wspolna sekcja admina: tickety, baza wiedzy, uzytkownicy, sklepy, kategorie.

Walidacja:

- smoke test: admin-only routing (role gate)
- testy/regresja: zmiana roli nie psuje `permissions` i widocznosci ticketow
- `npm run lint` - OK
- `npm run typecheck` - OK
- `npm run test` - OK, 32 passed / 1 skipped

## Priorytet 8 - Raporty i SLA [ZROBIONE]

Cel: dodac widoki kontrolingowe dla IT i administracji.

Zrealizowane:

- Matryca metryk w `lib/data-store.ts`:
  - `getDashboardMetrics()` — oblicza liczbe otwartych ticketow, krytycznych, sredni czas rozwiazania, top 5 kategorii oraz naruszenia SLA.
  - Oba runty (JSON + Prisma) — pelna zgodnosc danych.
- SLA:
  - `slaRules` — CRITICAL 4h, HIGH 8h, NORMAL 24h, LOW 48h.
  - Dashboard wyswietla liste naruszonych SLA z czasem po terminie, numerem ticketu, priorytetem, wykonawca i sklepem.
- Strona `/admin/reports`:
  - 4 karty metryk (wszystkie, otwarte, krytyczne, sredni czas).
  - Top 5 kategorii z paskami postepu.
  - Sekcja naruszen SLA (czerwona ramka, max 10 + informacja o wiekszej liczbie).
  - Tabela regul SLA dla wszystkich priorytetow.
  - Przycisk pobierania CSV.
- `/admin/reports/export`:
  - Endpoint POST generujacy CSV z lista wszystkich ticketow (numer, tytul, status, priorytet, kategoria, sklep, zglaszajacy, wykonawca, daty).
  - Poprawne escape'owanie pol zawierajacych przecinki, cudzyslowy lub znaki nowej linii.
- Nawigacja:
  - `components/admin/admin-nav.tsx` — link "Raporty" (ikona BarChart3) miedzy "Tickety" a "Baza wiedzy".
- `lib/types.ts`:
  - Nowy typ `DashboardMetrics` z polami `totalTickets`, `openTickets`, `criticalTickets`, `avgResolutionHours`, `topCategories`, `slaBreached`.

Walidacja:

- `npm run typecheck` — OK (0 errors)
- kod przejrzany przez code-reviewer-deepseek-flash

## Znane ograniczenia srodowiska

- W aktualnym srodowisku Codex nie byl dostepny Docker CLI, wiec `docker compose config` i `docker compose up` po Etapie 6 wymagaja walidacji na maszynie z Dockerem.
- `npm run build` zostal ponownie zweryfikowany po merge do `main` i przechodzi poprawnie.
- Prisma 6.x jest celowo uzyta dla zgodnosci z obecnym `schema.prisma`; przy przejsciu na Prisma 7 trzeba przeniesc konfiguracje seeda z `package.json#prisma` do `prisma.config.ts`.
- **Po Priorytecie 5** dodano pole `uploadedById` do `TicketAttachment` w Prisma schema. Wdrozenie na Railway wymaga migracji `prisma migrate deploy` przed startem aplikacji.
- **Po Priorytecie 7** doszedl model `AdminAuditLog` w Prisma schema. Wdrozenie na Railway wymaga migracji `prisma migrate deploy` przed startem aplikacji.
