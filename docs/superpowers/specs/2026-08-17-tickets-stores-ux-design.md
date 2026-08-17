# Uproszczenie filtrów zgłoszeń i widoku sklepów

## Cel

Zmniejszyć ilość miejsca zajmowanego przez filtry na stronie kolejki zgłoszeń oraz poprawić czytelność i wygodę edycji sklepów.

## Filtry zgłoszeń

Formularz filtrów na `/admin/tickets` zostanie przeniesiony do osobnego, klienckiego komponentu z kontrolowanym stanem rozwinięcia.

Stan początkowy:

- filtr jest zwinięty, gdy URL nie zawiera żadnego filtra;
- filtr jest rozwinięty, gdy aktywne są dowolne parametry `q`, `status`, `priority`, `assignee`, `store`, `category`, `mine`, `unassigned` lub `overdue`;
- wyszukiwarka pozostaje dostępna w nagłówku zwiniętego panelu;
- nagłówek pokazuje liczbę aktywnych filtrów.

Po rozwinięciu panel pokazuje istniejące pola: status, priorytet, wykonawcę, sklep, kategorię oraz checkboxy `Moje`, `Nieprzypisane` i `Po SLA`. Akcje `Filtruj` i `Wyczyść` zachowują obecne query params oraz paginację.

Panel będzie używał natywnego przycisku z `aria-expanded` i `aria-controls`, bez zmiany logiki filtrowania po stronie serwera. Wyszukiwarka i przycisk rozwijania pozostaną wygodne na mobile.

## Widok sklepów

Tabela na `/admin/stores` zostanie zastąpiona listą kart. Każda karta pokaże:

- kod, nazwę i status aktywności w nagłówku;
- miasto, adres i region w sekcji lokalizacji;
- liczbę użytkowników i zgłoszeń w sekcji statystyk;
- formularz edycji w siatce pól `Kod`, `Nazwa`, `Miasto`, `Adres`, `Region` oraz checkbox aktywności;
- przyciski `Zapisz` i `Usuń` w osobnym wierszu akcji.

Na desktopie formularz użyje kilku szerokich kolumn, a na mniejszych ekranach przejdzie do dwóch, a następnie jednej kolumny. Długie wartości adresowe nie będą ściskane przez sąsiednie pola. Istniejące server actions, hidden `id`, walidacja i potwierdzenie usunięcia pozostają bez zmian.

## Kryteria akceptacji

- Bez aktywnych filtrów panel filtrów nie zajmuje pełnej wysokości pierwszego ekranu.
- Przy aktywnym filtrze panel otwiera się automatycznie i pokazuje wszystkie aktualne wartości.
- Przycisk rozwijania ma poprawne `aria-expanded` i `aria-controls`.
- Filtrowanie, czyszczenie i przechodzenie między stronami działa tak jak wcześniej.
- Sklep jest renderowany jako karta, a pola edycji są czytelne na desktopie i mobile.
- Karty zachowują istniejące akcje tworzenia, aktualizacji i usuwania.
- Testy obejmują stan zwinięty/rozwinięty, aktywny filtr oraz renderowanie karty sklepu.

## Poza zakresem

- zmiana parametrów URL i logiki filtrowania;
- zmiana uprawnień lub server actions;
- przebudowa danych sklepu;
- zmiana pozostałych stron administracyjnych.
