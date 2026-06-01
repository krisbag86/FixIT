# UX Flows

## 1. Glowna zasada UX

Uzytkownik sklepu powinien moc utworzyc zgloszenie w mniej niz 60 sekund.

Interfejs powinien byc:

- prosty,
- responsywny,
- czytelny,
- odporny na stresowa sytuacje w sklepie,
- zgodny z dark mode.

## 2. Flow: nowe zgloszenie

1. Uzytkownik loguje sie.
2. Kliknie `Zglos awarie`.
3. Wybiera kategorie problemu.
4. System opcjonalnie pokazuje pasujace artykuly FAQ.
5. Uzytkownik wpisuje temat i opis.
6. Uzytkownik zaznacza, czy problem blokuje sprzedaz/prace.
7. Uzytkownik dodaje zalacznik, jesli potrzebny.
8. Uzytkownik wysyla zgloszenie.
9. System pokazuje numer ticketu i status.
10. System wysyla email potwierdzajacy.

## 3. Formularz ticketu

Pola:

- lokalizacja/sklep lub dzial,
- kategoria,
- temat,
- opis,
- czy problem blokuje sprzedaz/prace,
- pilnosc,
- zalaczniki,
- dane kontaktowe.

## 4. Kategorie w formularzu

Proponowane kategorie:

- Kasa / POS,
- Drukarka fiskalna,
- Terminal platniczy,
- Internet / siec,
- Komputer / laptop,
- Konto / dostep,
- Poczta,
- System wewnetrzny,
- Inne.

## 5. Flow: sledzenie zgloszenia

1. Uzytkownik wchodzi w `Moje zgloszenia`.
2. Widzi liste ticketow.
3. Otwiera wybrany ticket.
4. Widzi status, komentarze i historie zmian.
5. Moze dopisac komentarz.
6. Po rozwiazaniu widzi status `RESOLVED`.

## 6. Flow: kolejka IT

1. Agent wchodzi w `/admin/tickets`.
2. Widzi kolejke posortowana po priorytecie i aktualizacji.
3. Filtruje po statusie, sklepie, kategorii lub assignee.
4. Otwiera ticket.
5. Przypisuje wykonawce.
6. Zmienia status.
7. Dodaje komentarz publiczny albo notatke wewnetrzna.
8. Po rozwiazaniu ustawia `RESOLVED`.

## 7. Widok ticketu

Sekcje:

- naglowek: numer, tytul, status, priorytet,
- informacje: sklep/dzial, reporter, kategoria, assignee,
- opis problemu,
- komentarze,
- notatki wewnetrzne dla IT,
- zalaczniki,
- timeline zdarzen,
- akcje.

## 8. Dark mode

Wymagania:

- aplikacja zapamietuje preferencje,
- domyslnie moze respektowac system preference,
- wszystkie badge/statusy musza byc czytelne w obu trybach,
- tabele i formularze musza miec odpowiedni kontrast.
