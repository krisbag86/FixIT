# Product Spec - IT Helpdesk App

## 1. Cel produktu

Aplikacja ma sluzyc sklepom Bagietki oraz uzytkownikom biurowym do zglaszania awarii, usterek i prosb do dzialu IT.

System powinien zapewniac:

- szybkie tworzenie zgloszen,
- podglad statusu sprawy,
- komunikacje miedzy zglaszajacym a IT,
- baze wiedzy / FAQ,
- panel administracyjny dla IT,
- kolejke ticketow,
- przypisywanie wykonawcow,
- powiadomienia email,
- raportowanie i kontroling w pozniejszych etapach.

## 2. Grupy uzytkownikow

### Sklepy

Typowe zgloszenia:

- kasa / POS,
- drukarka fiskalna,
- terminal platniczy,
- internet / siec,
- komputer,
- system sprzedazowy,
- brak dostepu,
- awaria blokujaca sprzedaz.

### Biuro

Typowe zgloszenia:

- laptop / komputer,
- poczta,
- konto uzytkownika,
- dostep do systemu,
- drukarka,
- aplikacje wewnetrzne,
- siec / VPN.

### Dzial IT

Potrzeby:

- jedna kolejka spraw,
- statusy i priorytety,
- przypisywanie wykonawcow,
- notatki wewnetrzne,
- komentarze publiczne,
- historia zmian,
- powiadomienia,
- raportowanie.

## 3. Role

### REPORTER

Uzytkownik sklepu lub biura.

Moze:

- dodac zgloszenie,
- zobaczyc swoje zgloszenia,
- sprawdzic status,
- dodac komentarz,
- dodac zalacznik,
- korzystac z FAQ.

### STORE_MANAGER

Kierownik sklepu.

Moze:

- wszystko co `REPORTER`,
- widziec zgloszenia swojego sklepu,
- oznaczac zgloszenia jako pilne,
- potwierdzac rozwiazanie.

### AGENT

Pracownik IT / wykonawca.

Moze:

- widziec kolejke zgloszen,
- przypisywac tickety do siebie,
- zmieniac statusy,
- zmieniac priorytety,
- dodawac komentarze publiczne,
- dodawac notatki wewnetrzne,
- korzystac z widoku swoich zadan.

### ADMIN

Administrator systemu.

Moze:

- wszystko co `AGENT`,
- zarzadzac uzytkownikami,
- zarzadzac sklepami,
- zarzadzac kategoriami,
- zarzadzac FAQ,
- konfigurowac powiadomienia,
- przegladac raporty.

## 4. Moduly aplikacji

### Portal zglaszajacego

Ekrany:

- dashboard uzytkownika,
- nowe zgloszenie,
- moje zgloszenia,
- szczegoly zgloszenia,
- FAQ / baza wiedzy.

### Panel IT

Ekrany:

- kolejka ticketow,
- szczegoly ticketu,
- moje zadania,
- kanban,
- uzytkownicy,
- sklepy,
- kategorie,
- baza wiedzy,
- raporty.

## 5. Statusy ticketow

- `NEW` - nowe zgloszenie,
- `TRIAGED` - zweryfikowane i sklasyfikowane,
- `IN_PROGRESS` - w trakcie realizacji,
- `WAITING_FOR_USER` - oczekuje na odpowiedz uzytkownika,
- `WAITING_FOR_VENDOR` - oczekuje na dostawce,
- `RESOLVED` - rozwiazane,
- `CLOSED` - zamkniete,
- `CANCELLED` - anulowane.

## 6. Priorytety

- `LOW`,
- `NORMAL`,
- `HIGH`,
- `CRITICAL`.

Zgloszenie blokujace sprzedaz powinno automatycznie sugerowac priorytet `CRITICAL`.

## 7. Wymagania UX

- Zgloszenie powinno byc mozliwe w mniej niz 60 sekund.
- Formularz powinien byc prosty i przyjazny na telefonie.
- Interfejs powinien byc nowoczesny i intuicyjny.
- Tryb ciemny jest wymagany.
- Panel IT powinien miec szybkie filtry i sortowanie.

## 8. MVP

Must-have:

- logowanie tylko przez email `@bagietka.pl`,
- role i uprawnienia,
- tworzenie ticketu,
- lista moich ticketow,
- szczegoly ticketu,
- panel IT z kolejka,
- zmiana statusu,
- przypisanie wykonawcy,
- komentarze publiczne i wewnetrzne,
- podstawowe powiadomienia email,
- dark mode.

Should-have:

- FAQ,
- zalaczniki,
- dashboard IT,
- kategorie z domyslnym priorytetem.

Could-have:

- SLA,
- raporty,
- kanban drag and drop,
- szablony odpowiedzi,
- integracje Teams/Slack.
