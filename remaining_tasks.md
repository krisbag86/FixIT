# Remaining Tasks - FixIT Helpdesk

Lista zadan do wdrozenia w przyszlych sesjach. Aktualizuj ten plik po kazdym ukonczonym etapie. Stan na: po Etapie 7 (testy E2E magic link + powiadomienia, na logach).

Legenda priorytetow: **P0** krytyczne (blokuje produkcje), **P1** wazne, **P2** ulepszenia/hardening.

---

## Co juz dziala (skrot)

- Logowanie magic link (bez hasla) z restrykcja domeny `@bagietka.pl`; pierwszy klik linku zaklada aktywne konto `REPORTER`.
- Tworzenie ticketu (`IT-YYYY-NNNN`), portal zglaszajacego, panel IT (kolejka/filtry/metryki), zmiana statusu/priorytetu/assignee, komentarze publiczne + notatki wewnetrzne, timeline.
- Warstwa email `lib/email.ts` (Resend REST API gdy `RESEND_API_KEY`, inaczej log do konsoli), szablony per case `lib/email-templates.ts`, orkiestracja `lib/notifications.ts` z zapisem `SENT`/`FAILED`.
- Powiadomienia wpiete w zdarzenia ticketow (utworzenie, przypisanie, komentarz publiczny, rozwiazanie).
- Runtime na JSON-store (`.data/fixit-db.json`); kontrakt `prisma/schema.prisma` gotowy na migracje.
- Testy jednostkowe (15), lint, typecheck, build - OK.

---

## P0 - Krytyczne

### 1. Realna wysylka email przez Resend (produkcja)
- **Kontekst:** Warstwa jest gotowa (`lib/email.ts` woła REST API Resend). Brakuje produkcyjnego klucza i zweryfikowanej domeny nadawcy, wiec realnie maile nie wychodza (lecą do logu).
- **Do zrobienia:**
  - Zweryfikowac domene `bagietka.pl` w Resend (rekordy DNS: SPF, DKIM).
  - Ustawic `RESEND_API_KEY` i `EMAIL_FROM` (np. `FixIT Helpdesk <no-reply@bagietka.pl>`) w env produkcyjnym (Railway).
  - Ustawic `APP_URL` na publiczny adres, zeby linki w mailach byly poprawne.
- **Kryteria akceptacji:** realny mail z magic linkiem dociera na skrzynke `@bagietka.pl`; `notification_logs` pokazuje `SENT` z `provider: resend`.
- **Uwaga:** do czasu weryfikacji domeny mozna testowac z nadawca `onboarding@resend.dev`, ale Resend dostarczy tylko na adres wlasciciela konta Resend.

### 2. Migracja runtime z JSON-store na Prisma/PostgreSQL
- **Kontekst:** Aplikacja czyta/pisze do `.data/fixit-db.json` (`lib/data-store.ts`). `prisma/schema.prisma` ma juz modele (w tym `MagicToken`), ale runtime ich nie uzywa. Postgres jest w `docker-compose.yml`, ale nieuzywany.
- **Do zrobienia:**
  - Dodac `@prisma/client`, wygenerowac klienta, ustawic `DATABASE_URL`.
  - Przepisac operacje z `lib/data-store.ts` na Prisma (users, tickets, comments, events, magicTokens, notification_logs).
  - Migracje (`prisma migrate`) + seed (`lib/seed.ts`) na Prisma.
  - Przeniesc tokeny magic link i notification logs do bazy.
- **Kryteria akceptacji:** pelny przeplyw (login -> ticket -> komentarz) dziala na Postgres; testy i build przechodza; brak zaleznosci od pliku JSON w produkcji.

---

## P1 - Wazne (funkcjonalne)

### 3. CRUD admina: uzytkownicy, sklepy, kategorie
- **Kontekst:** Role i sklepy sa w seedzie, ale brak UI do zarzadzania. Potrzebne do nadawania rol (`AGENT`, `ADMIN`, `STORE_MANAGER`) i utrzymania slownikow.
- **Kryteria akceptacji:** ADMIN moze dodac/edytowac/dezaktywowac uzytkownika, zmienic role, zarzadzac sklepami i kategoriami; zmiany widoczne w aplikacji.

### 4. "Moje zadania" + kanban dla IT
- **Kontekst:** AGENT potrzebuje widoku przypisanych do niego ticketow i tablicy kanban po statusach.
- **Kryteria akceptacji:** widok filtruje po `assigneeId = current user`; kanban pozwala zmieniac status drag&drop lub akcja.

### 5. FAQ / baza wiedzy
- **Kontekst:** Self-service do redukcji liczby ticketow (deflekcja powtarzalnych zgloszen - standard w Zendesk/Freshservice/GLPI). Typ `KnowledgeArticle` jest juz w `lib/types.ts`, brak UI i wyszukiwarki.
- **Kryteria akceptacji:** lista artykulow z wyszukiwarka; CRUD dla ADMIN; powiazanie z kategoria; mierzalna deflekcja (link z artykulu zamiast zakladania ticketu).

### 6. Raporty / SLA / eksport CSV
- **Kryteria akceptacji:** metryki (czas reakcji, czas rozwiazania, liczba wg statusu/priorytetu); eksport do CSV.

### 7. Zalaczniki do ticketow
- **Kontekst:** `TicketAttachment` jest w schemacie Prisma, brak runtime/UI.
- **Kryteria akceptacji:** mozna dodac plik do ticketu i go pobrac; walidacja typu/rozmiaru.

---

## P1 - Funkcje z benchmarku rynkowego

Wynik analizy konkurencji (Zendesk, Freshservice, Jira Service Management, Zammad, GLPI). Pelne uzasadnienie i kolejnosc w `propozycja-funkcji.md`. FAQ/baza wiedzy z tej listy jest juz powyzej jako zadanie #5.

### 14. SLA + eskalacje
- **Kontekst:** Standard w kazdym ITSM. Pole `dueAt` jest juz w modelu `Ticket`, ale brak polityk i logiki. Liczenie powinno uwzgledniac godziny pracy.
- **Do zrobienia:** polityki czasu reakcji/rozwiazania wg priorytetu; auto-`dueAt` przy tworzeniu; alert/eskalacja przy zblizaniu sie deadline; oznaczenie naruszenia SLA. Fast-track dla `blocksWork=true` (auto-CRITICAL + krotkie SLA).
- **Kryteria akceptacji:** ticket dostaje `dueAt` wg priorytetu; przekroczenie SLA jest widoczne i raportowane; eskalacja wyzwala powiadomienie.

### 15. Automatyzacje / reguly routingu
- **Kontekst:** Auto-przypisanie i triage redukuja prace reczna (Freshservice/Zendesk).
- **Do zrobienia:** reguly auto-assignment wg kategorii/sklepu; auto-priorytet wg kategorii (`Category.defaultPriority` juz istnieje); triggery (np. CRITICAL + `blocksWork` -> natychmiast do dyzurnego); szablony zgloszen dla typowych awarii (kasa nie drukuje, terminal offline) z auto-kategoria/priorytetem.
- **Kryteria akceptacji:** nowy ticket pasujacy do reguly jest automatycznie kategoryzowany/przypisywany; szablony skracaja czas zgloszenia.

### 16. CSAT - ankieta satysfakcji po rozwiazaniu
- **Kontekst:** Pomiar jakosci wsparcia (standard rynkowy). Wpinane w istniejacy mail o rozwiazaniu.
- **Do zrobienia:** w mailu `ticket rozwiazany` link do oceny (1-5 + komentarz); zapis oceny; raport CSAT.
- **Kryteria akceptacji:** zglaszajacy moze ocenic rozwiazanie; wynik widoczny w raportach.

### 17. Asset management / CMDB per sklep (+ QR)
- **Kontekst:** Wyroznik dla sieci sklepow (POS, drukarki fiskalne, terminale platnicze, wagi). GLPI/Freshservice maja to wprost.
- **Do zrobienia:** rejestr urzadzen per sklep (nr seryjny, gwarancja, dostawca); powiazanie ticketu z urzadzeniem; **QR na sprzecie** -> skan otwiera formularz z wypelnionym sklepem i urzadzeniem; eskalacja do serwisu zewnetrznego (status `WAITING_FOR_VENDOR` juz istnieje, dodac kontakty/numer u dostawcy); raport awaryjnosci wg sklepu/urzadzenia.
- **Kryteria akceptacji:** urzadzenie da sie zarejestrowac i powiazac z ticketem; skan QR preselekcjonuje sklep+urzadzenie; raport pokazuje powtarzalne usterki.

---

## P2 - Jakosc i bezpieczenstwo (hardening)

### 8. Rate limiting wysylki magic linkow
- **Kontekst:** Brak limitu - mozliwy spam/abuse na `loginAction`.
- **Kryteria akceptacji:** limit np. N requestow / adres / okno czasu; nadmiarowe zadania odrzucane lub kolejkowane.

### 9. Audit log zmian rol i statusow
- **Kryteria akceptacji:** kazda zmiana roli/statusu/przypisania zapisuje wpis audytu (kto, co, kiedy).

### 10. Testy e2e i integracyjne
- **Kontekst:** Sa testy jednostkowe (15). Brak e2e (Playwright) dla loginu, tworzenia ticketu, panelu IT, widocznosci notatek wewnetrznych.
- **Kryteria akceptacji:** zestaw e2e przechodzi w CI dla golden-path flows.

### 11. CI w repo
- **Kontekst:** Repo nie ma CI (0 checks na PR). Walidacja jest tylko lokalna.
- **Kryteria akceptacji:** workflow uruchamia lint + typecheck + test + build na PR.

### 12. Audyt podatnosci npm
- **Kontekst:** `npm audit` raportowal podatnosci w zaleznosciach. Nie stosowano `--force` (ryzyko breaking changes).
- **Kryteria akceptacji:** podatnosci ocenione i naprawione bez regresji.

### 13. Normalizacja koncow linii (CRLF/LF)
- **Kontekst:** Commit na `main` przekonwertowal pliki na CRLF, co powoduje pozorne konflikty przy merge. Repo nie ma `.gitattributes`.
- **Kryteria akceptacji:** dodany `.gitattributes` wymuszajacy LF dla zrodel; jednorazowa renormalizacja repo; przyszle merge bez konfliktow whitespace.

---

## Konfiguracja / env (referencja)

- `RESEND_API_KEY` - pusty = log do konsoli; ustawiony = realna wysylka.
- `EMAIL_FROM` - nadawca, np. `FixIT Helpdesk <no-reply@bagietka.pl>`.
- `APP_URL` - publiczny adres do budowy linkow w mailach.
- `MAGIC_LINK_TTL_MINUTES` - waznosc tokenu (domyslnie 15).
- `DATABASE_URL` - potrzebny przy migracji na Prisma/PostgreSQL.

## Konta testowe (seed)

`admin@bagietka.pl` (ADMIN), `agent@bagietka.pl` (AGENT), `sklep.waw01@bagietka.pl`, `kasjer@bagietka.pl`. Logowanie: wpisz adres na `/login`, link wez z logu serwera (gdy brak `RESEND_API_KEY`).
