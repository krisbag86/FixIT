# Development Plan - IT Helpdesk App

## 1. Zasada prowadzenia developmentu

Projekt powinien byc realizowany etapami, w malych, weryfikowalnych jednostkach. Kazdy task dla agenta AI powinien miec:

- cel,
- kontekst,
- kryteria akceptacji,
- pliki prawdopodobnie do zmiany,
- testy,
- komende walidacyjna.

Rekomendowany cykl:

1. Zdefiniuj test lub acceptance criteria.
2. Zaimplementuj.
3. Uruchom lint/typecheck/test.
4. Sprawdz regresje.
5. Zrob krotki changelog.

## 2. Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- PostgreSQL
- Railway
- Auth.js lub magic link / credentials auth dla MVP
- Resend/SMTP do maili

## 3. Faza 0 - Fundament

### 0.1. Inicjalizacja projektu

Cel: utworzyc aplikacje Next.js z TypeScript, Tailwind i shadcn/ui.

Done:

- projekt startuje lokalnie,
- jest bazowy layout,
- dziala dark mode,
- sa skonfigurowane lint i typecheck.

Walidacja:

```bash
npm run dev
npm run lint
npm run typecheck
```

### 0.2. Prisma i PostgreSQL

Cel: podpiac baze danych.

Done:

- skonfigurowany Prisma,
- dziala `DATABASE_URL`,
- pierwsza migracja tworzy tabele,
- seed tworzy dane testowe.

Walidacja:

```bash
npx prisma migrate dev
npx prisma db seed
```

### 0.3. Design system

Cel: przygotowac komponenty bazowe.

Komponenty:

- AppShell,
- Sidebar,
- Topbar,
- StatusBadge,
- PriorityBadge,
- EmptyState,
- DataTable,
- ConfirmDialog,
- Toast.

Done:

- komponenty dzialaja w light/dark mode,
- sa responsywne,
- maja stany loading/empty/error.

## 4. Faza 1 - Auth i role

### 1.1. Logowanie

Cel: uzytkownik moze sie zalogowac.

Done:

- login,
- logout,
- sesja,
- ochrona tras,
- blokada domeny innej niz `bagietka.pl`.

### 1.2. Permissions

Cel: kontrola dostepu.

Done:

- `REPORTER` nie wejdzie do `/admin`,
- `AGENT` widzi kolejke,
- `ADMIN` widzi ustawienia,
- helper `can(user, action, resource)`.

## 5. Faza 2 - Ticket MVP

### 2.1. Modele ticketow

Done:

- tabele: tickets, comments, events, categories,
- numeracja `IT-YYYY-NNNN`,
- event log przy tworzeniu ticketu.

### 2.2. Formularz nowego zgloszenia

Done:

- walidacja formularza,
- zapis w DB,
- status `NEW`,
- przypisanie sklepu/dzialu,
- redirect do szczegolow.

### 2.3. Lista moich zgloszen

Done:

- lista/tabela,
- filtry statusu,
- sortowanie po aktualizacji,
- mobile-friendly layout.

### 2.4. Szczegoly zgloszenia

Done:

- szczegoly ticketu,
- komentarze publiczne,
- historia zmian,
- dodawanie komentarza.

## 6. Faza 3 - Panel IT

### 3.1. Kolejka zgloszen

Done:

- tabela ticketow,
- filtry,
- status,
- priorytet,
- sklep/dzial,
- kategoria,
- assignee,
- query params w URL.

### 3.2. Szczegoly ticketu dla IT

Done:

- zmiana statusu,
- zmiana priorytetu,
- przypisanie wykonawcy,
- komentarze publiczne,
- notatki wewnetrzne,
- event log.

### 3.3. Moje zadania

Done:

- tickety przypisane do mnie,
- szybkie akcje,
- filtry: po terminie, oczekujace, dzis zmienione.

## 7. Faza 4 - Email

### 4.1. Serwis email

Done:

- abstrakcja `sendEmail`,
- szablony maili,
- logowanie wysylek w `notification_logs`.

### 4.2. Powiadomienia ticketowe

Done:

- email po utworzeniu ticketu,
- email po przypisaniu,
- email po komentarzu publicznym,
- email po rozwiazaniu.

## 8. Faza 5 - FAQ

### 5.1. Publiczna baza wiedzy

Done:

- lista artykulow,
- wyszukiwarka,
- kategorie,
- widok artykulu.

### 5.2. Zarzadzanie FAQ

Done:

- CRUD artykulow,
- publikacja/ukrycie,
- przypisanie kategorii.

### 5.3. Sugestie FAQ przy zgloszeniu

Done:

- po wyborze kategorii pokazujemy powiazane artykuly,
- uzytkownik moze zrezygnowac z wysylki ticketu, jesli FAQ rozwiaze problem.

## 9. Faza 6 - Administracja

Done:

- CRUD uzytkownikow,
- CRUD sklepow,
- CRUD kategorii,
- dezaktywacja uzytkownikow,
- przypisanie rol.

## 10. Faza 7 - Raporty

Done:

- liczba otwartych ticketow,
- tickety krytyczne,
- tickety po SLA,
- sredni czas rozwiazania,
- top kategorie,
- eksport CSV.

## 11. Kolejnosc wdrazania

Najpierw pionowy plaster:

```text
login -> create ticket -> admin queue -> assign/change status -> comment -> email
```

Dopiero potem FAQ, raporty, SLA i automatyzacje.
