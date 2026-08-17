# Portal zgłaszającego — specyfikacja UX i bezpieczeństwa

## Cel

Uprościć doświadczenie użytkowników sklepowych w rolach `REPORTER` i `STORE_MANAGER` do jednego, lekkiego portalu: szybkie zgłoszenie problemu, podgląd postępu, publiczna komunikacja z IT, archiwum własnych zgłoszeń i baza wiedzy.

Zmiana nie obejmuje jeszcze usunięcia ani zastąpienia roli `STORE_MANAGER`. Obie role zachowują swoje nazwy techniczne, ale w portalu zgłaszającego korzystają z tego samego uproszczonego doświadczenia.

## Zakres

### Portal i nawigacja

Użytkownicy `REPORTER` i `STORE_MANAGER` otrzymują ten sam portal:

- `/tickets` — prosty pulpit z przyciskiem „Zgłoś problem” i listą aktywnych własnych zgłoszeń.
- `/tickets/new` — uproszczony formularz zgłoszenia.
- `/tickets/archive` — zamknięte i anulowane zgłoszenia zgłaszającego.
- `/tickets/[id]` — uproszczone szczegóły pojedynczego zgłoszenia.
- `/knowledge` — opublikowana baza wiedzy pozostaje dostępna.

Nawigacja portalu zawiera wyłącznie:

- Moje zgłoszenia,
- Nowe zgłoszenie,
- Archiwum,
- Baza wiedzy.

Link „Mój sklep” i rozbudowany dashboard sklepu nie są dostępne w tym portalu. Panel IT dla `AGENT` i `ADMIN` pozostaje bez zmian.

Nagłówek portalu pokazuje nazwę użytkownika, przełącznik motywu i wylogowanie. Nie pokazuje roli ani adresu e-mail.

### Pulpit własnych zgłoszeń

Strona `/tickets` zawiera:

- nagłówek „W czym możemy pomóc?”,
- duży przycisk „Zgłoś problem”,
- sekcję aktywnych zgłoszeń,
- proste karty zgłoszeń.

Karta pokazuje wyłącznie numer, temat, datę ostatniej aktualizacji i publiczny etap progressu. Nie pokazuje priorytetu, SLA, wykonawcy, lokalizacji, danych zgłaszającego ani metryk.

Na stronie nie ma wyszukiwarki, filtrów ani statystyk.

### Formularz nowego zgłoszenia

Formularz pozostawia tylko pola potrzebne do opisania problemu:

- kategoria,
- temat,
- opis,
- opcjonalny kontakt zwrotny.

FAQ pozostaje dostępne jako pomocnicza sekcja formularza.

Sklep jest pobierany z profilu użytkownika i nie jest wybierany ręcznie. Priorytet, dział, `blocksWork`, `submissionId` i pozostałe dane techniczne nie są elementami interfejsu portalu.

Po stronie serwera dla `REPORTER` i `STORE_MANAGER`:

- `storeId` pochodzi z profilu użytkownika,
- priorytet wynika z kategorii i istniejących reguł,
- `blocksWork` nie jest przyjmowane z formularza portalu,
- ukryte lub ręcznie dodane pola techniczne nie rozszerzają uprawnień użytkownika.

### Szczegóły zgłoszenia i progress

Uproszczony widok `/tickets/[id]` pokazuje:

- numer i temat,
- opis zgłoszenia,
- pasek progressu,
- publiczne odpowiedzi IT,
- krótką odpowiedź zgłaszającego,
- akcję potwierdzenia rozwiązania, gdy zgłoszenie ma status `RESOLVED` i użytkownik ma do tego uprawnienie.

Wewnętrzne statusy są mapowane na publiczne etapy:

| Status wewnętrzny | Etap publiczny |
| --- | --- |
| `NEW`, `TRIAGED` | Przyjęte |
| `IN_PROGRESS` | W trakcie |
| `WAITING_FOR_USER`, `WAITING_FOR_VENDOR` | Oczekuje |
| `RESOLVED` | Rozwiązane |
| `CLOSED` | Zamknięte |
| `CANCELLED` | Anulowane |

Zgłaszający może wysłać krótką odpowiedź. Portal nie pokazuje wyboru widoczności ani narzędzi szablonów; każda odpowiedź z tego widoku jest wymuszana po stronie serwera jako `PUBLIC`.

### Archiwum

`/tickets/archive` korzysta z tego samego prostego języka kart co pulpit. Pokazuje wyłącznie zgłoszenia, których `reporterId` jest równy zalogowanemu użytkownikowi. Nie pokazuje filtrów, wyszukiwarki ani danych technicznych.

## Bezpieczeństwo i zakres danych

Uproszczenie jest realizowane na poziomie zapytań, uprawnień i renderowania:

- `REPORTER` widzi tylko własne zgłoszenia.
- `STORE_MANAGER` w tym portalu również widzi tylko własne zgłoszenia; nie otrzymuje widoku zgłoszeń całego sklepu.
- Bezpośredni URL do cudzego zgłoszenia nie udostępnia danych.
- Komentarze dla portalu są ograniczone do `PUBLIC`.
- Odpowiedź reportera jest zawsze zapisywana jako `PUBLIC`, nawet jeśli klient wyśle ręcznie wartość `INTERNAL`.
- Historia techniczna, wykonawca, SLA, priorytet, lokalizacja i akcje IT nie są przekazywane do uproszczonego komponentu.
- Uprawnienia `AGENT` i `ADMIN`, ich kolejka oraz szczegóły administracyjne pozostają bez zmian.

Istniejące API danych i akcje serwerowe są rozszerzane tylko tam, gdzie jest to konieczne do wymuszenia powyższego zakresu. Nie wprowadzamy nowej roli ani migracji schematu w tym zadaniu.

## Granice komponentów

- `AppNav` otrzymuje uproszczony zestaw linków dla użytkowników portalu.
- `AppShell` nie pokazuje roli i adresu e-mail w portalu zgłaszającego.
- `TicketCard` lub dedykowany wariant karty renderuje tylko publiczne podsumowanie ticketu.
- Dedykowany komponent szczegółów portalu oddziela publiczny progress i rozmowę od administracyjnego `TicketDetail`.
- Dedykowany wariant formularza portalu zachowuje FAQ, ale nie renderuje pól technicznych.
- Helper mapujący statusy publiczne pozostaje niezależny od etykiet statusów wewnętrznych i będzie testowalny bez JSX.

## Kryteria akceptacji

1. Po zalogowaniu `REPORTER` i `STORE_MANAGER` widzą ten sam uproszczony portal.
2. Pulpit pokazuje CTA „Zgłoś problem” i tylko aktywne własne zgłoszenia.
3. Archiwum pokazuje tylko własne zgłoszenia zamknięte/anulowane.
4. Formularz zawiera kategorię, temat, opis, kontakt i FAQ; sklep jest ustawiany automatycznie.
5. Szczegóły pokazują publiczny progress i publiczne odpowiedzi bez danych technicznych.
6. Reporter może wysłać krótką odpowiedź, która zawsze jest publiczna.
7. Reporter ani store manager nie mogą odczytać cudzego ticketu przez bezpośredni URL.
8. Panel IT i uprawnienia `AGENT`/`ADMIN` przechodzą istniejące testy bez regresji.
9. Testy E2E pokrywają portal obu ról, izolację ticketów, status progressu, FAQ i publiczną odpowiedź.

## Poza zakresem

- usunięcie lub zmiana nazwy `STORE_MANAGER`,
- wprowadzenie `OFFICE_USER`,
- nowy dashboard kierownika sklepu,
- zmiana modelu danych ticketu,
- zmiana panelu IT,
- przebudowa bazy wiedzy poza dostosowaniem jej nawigacji do prostego portalu.
