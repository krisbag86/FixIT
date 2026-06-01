# Testing and Quality Plan

## 1. Eval-first workflow

Kazda funkcja powinna zaczynac sie od kryteriow akceptacji lub testu.

Cykl:

1. Zdefiniuj expected behavior.
2. Napisz test lub acceptance checklist.
3. Zaimplementuj.
4. Uruchom walidacje.
5. Sprawdz regresje.

## 2. Minimalne komendy walidacyjne

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

Jesli e2e nie jest jeszcze skonfigurowane, agent powinien nie udawac, ze je uruchomil. Powinien wpisac, ze e2e nie istnieje i dodac task konfiguracji.

## 3. Testy jednostkowe

Obszary:

- walidacja domeny email,
- permissions,
- generowanie numeru ticketu,
- walidacja formularzy,
- przejscia statusow,
- widocznosc komentarzy.

## 4. Testy integracyjne

Scenariusze:

- tworzenie ticketu,
- zmiana statusu,
- przypisanie wykonawcy,
- dodanie komentarza,
- ukrycie notatek wewnetrznych przed reporterem,
- wysylka notification log.

## 5. Testy e2e

### Tworzenie ticketu

```text
Given zalogowany uzytkownik z domeny bagietka.pl
When wypelnia formularz zgloszenia
Then system tworzy ticket ze statusem NEW
And uzytkownik widzi szczegoly ticketu
And ticket ma numer IT-YYYY-NNNN
```

### Blokada obcej domeny

```text
Given uzytkownik z emailem jan@gmail.com
When probuje sie zalogowac
Then system odrzuca logowanie
And pokazuje czytelny komunikat
```

### Uprawnienia admina

```text
Given uzytkownik REPORTER
When probuje wejsc na /admin/tickets
Then otrzymuje brak dostepu
```

### Notatka wewnetrzna

```text
Given agent dodaje notatke wewnetrzna
When reporter otwiera ticket
Then reporter nie widzi tej notatki
```

## 6. Checklist review kodu AI

Sprawdzic:

- czy walidacje sa po stronie serwera,
- czy permission checks sa przed mutacjami,
- czy reporter nie widzi cudzych ticketow,
- czy internal notes nie wyciekaja,
- czy status changes tworza event log,
- czy email failure nie psuje glownej operacji,
- czy sa testy dla edge case'ow,
- czy migracje sa bezpieczne,
- czy nie ma sekretow w kodzie.

## 7. Definition of Done

Feature jest skonczony, gdy:

- spelnia acceptance criteria,
- ma testy lub jasne uzasadnienie braku testow,
- przechodzi lint,
- przechodzi typecheck,
- nie lamie permissions,
- jest responsywny,
- dziala w dark mode,
- ma obsluge error/loading/empty state.
