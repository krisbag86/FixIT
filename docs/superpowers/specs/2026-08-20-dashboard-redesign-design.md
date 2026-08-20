# Przebudowa Pulpitu zespołu IT

## Cel

Przekształcić `/admin/dashboard` w hybrydowy ekran pracy zespołu IT: centrum operacyjne ma wskazywać sprawy wymagające reakcji i osobistą kolejkę zalogowanego użytkownika, a dolna część ma zachować zwięzły przegląd analityczny z ostatnich 30 dni.

Pulpit pozostaje dostępny wyłącznie dla ról AGENT i ADMIN przez istniejące sprawdzenie `canUseAdmin`. Nie powstaje nowy mechanizm autoryzacji, osobny endpoint API ani nowe miejsce przechowywania danych.

## Uzgodniony kierunek

Pulpit łączy dwa poziomy informacji:

- u góry centrum operacyjne, obejmujące wspólne alarmy zespołu i osobistą kolejkę pracy;
- poniżej uproszczoną analitykę obejmującą stały okres ostatnich 30 dni.

Na desktopie centrum operacyjne używa dwóch kolumn. Sekcja alarmowa jest szersza, a `Moje zgłoszenia` zajmują węższą kolumnę. Na mniejszych ekranach sekcje układają się kolejno w jednej kolumnie: alarmy, osobista kolejka, statystyki i moduły analityczne.

## Centrum operacyjne

### Alarmy zespołowe

Sekcja `Wymaga reakcji` pokazuje wyłącznie:

- liczbę otwartych zgłoszeń z priorytetem `CRITICAL`;
- liczbę otwartych zgłoszeń z przekroczonym SLA;
- jedną wspólną listę najpilniejszych zgłoszeń spełniających co najmniej jeden z tych warunków.

Zgłoszenie krytyczne, które ma również przekroczone SLA, pojawia się na wspólnej liście tylko raz. Pulpit pokazuje maksymalnie pięć pozycji. Kolejność listy:

1. zgłoszenia jednocześnie krytyczne i po SLA;
2. pozostałe zgłoszenia krytyczne;
3. pozostałe zgłoszenia po SLA.

W pierwszej i trzeciej grupie o kolejności decyduje największe przekroczenie SLA. W drugiej grupie starsze zgłoszenia są pokazywane wcześniej. Każdy wiersz pokazuje numer, tytuł, sklep, jeśli jest przypisany, oraz powód alarmu. Kliknięcie prowadzi do szczegółów zgłoszenia.

Kliknięcie licznika `Krytyczne` otwiera `/admin/tickets?attention=critical`. Kliknięcie licznika `SLA przekroczone` otwiera `/admin/tickets?attention=overdue`. Link końcowy prowadzi do `/admin/tickets?attention=all`. Nowy parametr `attention` przyjmuje wyłącznie wartości `critical`, `overdue` lub `all` i zawsze ogranicza wyniki do otwartych zgłoszeń. Nie zmienia znaczenia istniejących parametrów `priority` ani `overdue`.

### Jedna definicja SLA

Pulpit i kolejka zgłoszeń korzystają z tej samej definicji terminu SLA:

- jeżeli zgłoszenie ma poprawne `dueAt`, jest to jego termin;
- w przeciwnym razie termin wynika z `createdAt` oraz limitu dla priorytetu;
- zgłoszenia w statusach `RESOLVED`, `CLOSED` i `CANCELLED` nie są traktowane jako przeterminowane.

Obliczenia Prisma i JSON muszą dawać ten sam wynik. Implementacja nie może utrzymywać osobnej, rozbieżnej definicji SLA tylko na potrzeby Pulpitu.

### Moje zgłoszenia

Sekcja obejmuje wyłącznie aktywne zgłoszenia przypisane do zalogowanego AGENTA lub ADMINA. Zgłoszenia są pogrupowane w trzy zakładki:

| Zakładka | Statusy |
| --- | --- |
| Nowe | `NEW`, `TRIAGED` |
| Oczekujące | `WAITING_FOR_USER`, `WAITING_FOR_VENDOR` |
| W realizacji | `IN_PROGRESS` |

Każda zakładka pokazuje pełny licznik swojej grupy. Domyślnie aktywna jest zakładka `Nowe`. Aktywna zakładka wyświetla maksymalnie pięć zgłoszeń, uporządkowanych według priorytetu od najwyższego, a następnie od najstarszego.

Wiersz pokazuje numer, tytuł i priorytet zgłoszenia oraz prowadzi do jego szczegółów. Link `Zobacz wszystkie` otwiera `/admin/tickets` z parametrami `mine=1` oraz `stage=new`, `stage=waiting` albo `stage=in_progress`. Nowy parametr `stage` nie zastępuje istniejącego filtra pojedynczego statusu. Jeżeli URL zawiera jednocześnie `status` i `stage`, filtr pojedynczego `status` ma pierwszeństwo, a `stage` jest ignorowany.

Zmiana zakładki odbywa się po stronie klienta bez przeładowania całej strony. Serwer przekazuje liczniki oraz maksymalnie pięć rekordów dla każdej grupy, więc przełączanie nie wymaga dodatkowych żądań.

## Analityka

Analityka zawsze obejmuje ostatnie 30 dni. Pulpit nie zawiera przełącznika okresu ani osobnych zakresów czasu dla modułów.

Osobny rząd czterech dotychczasowych kart KPI zostaje usunięty. Przy nagłówku analityki pojawiają się dwie kompaktowe statystyki:

- `Otwarte zgłoszenia` — wszystkie zgłoszenia poza `RESOLVED`, `CLOSED` i `CANCELLED`;
- `Średni czas rozwiązania` — średnia różnica między `createdAt` i `resolvedAt` dla zgłoszeń rozwiązanych w ostatnich 30 dniach.

Dolna część zawiera trzy moduły:

1. `Utworzone i rozwiązane` — liczba zgłoszeń utworzonych i rozwiązanych każdego dnia w ostatnich 30 dniach;
2. `Top kategorie` — maksymalnie osiem najczęstszych kategorii wśród aktualnie otwartych zgłoszeń;
3. `Obciążenie agentów` — liczba aktualnie otwartych zgłoszeń przypisanych do aktywnych AGENTÓW i ADMINÓW; lista obejmuje osoby mające co najmniej jedno takie zgłoszenie.

`resolvedAt` pozostaje znacznikiem rozwiązania również po potwierdzeniu i przejściu `RESOLVED → CLOSED`. Ponowne otwarcie zgłoszenia do aktywnego statusu czyści nieaktualny `resolvedAt`, a kolejne przejście do `RESOLVED` ustawia nowy czas. Ta reguła obowiązuje przyszłe zmiany statusu; specyfikacja nie przewiduje automatycznego uzupełniania brakujących znaczników w danych historycznych.

Sekcja `Ostatnia aktywność` zostaje usunięta z Pulpitu. Pełne zestawienia i porównania okresów pozostają na stronie `Raporty`.

## Kontrakt danych

`getDashboardData` przyjmuje bieżącego użytkownika i zwraca jeden kontrakt `DashboardData` obejmujący:

- `alerts`:
  - `criticalCount`;
  - `slaBreachedCount`;
  - zdeduplikowaną listę najpilniejszych zgłoszeń wraz z informacją, które warunki spełniają;
- `myQueue`:
  - liczniki trzech grup;
  - maksymalnie pięć zgłoszeń dla każdej grupy;
- `analytics`:
  - liczbę otwartych zgłoszeń;
  - średni czas rozwiązania dla zakresu 30 dni;
  - dzienne liczby utworzonych i rozwiązanych zgłoszeń;
  - top kategorie otwartych zgłoszeń;
  - obciążenie aktywnych agentów.

Kontrakt zwraca wyłącznie pola potrzebne do renderowania Pulpitu. Nie zawiera opisu zgłoszenia, danych kontaktowych, komentarzy, notatek wewnętrznych ani załączników.

Implementacja Prisma używa ograniczonych zapytań agregujących i selekcji wymaganych pól. Implementacja JSON stosuje te same reguły do danych z pliku. Obie ścieżki muszą mieć wspólne testy kontraktowe i identyczną semantykę.

## Komponenty i odpowiedzialności

- `app/admin/dashboard/page.tsx` odpowiada za uwierzytelnienie, sprawdzenie dostępu, pobranie danych dla bieżącego użytkownika oraz złożenie strony.
- `components/admin/it-dashboard.tsx` odpowiada za responsywny układ centrum operacyjnego i analityki.
- Osobny mały komponent kliencki obsługuje wyłącznie aktywną zakładkę `Moje zgłoszenia`. Nie pobiera danych i nie przejmuje odpowiedzialności za agregację.
- `lib/data-store.ts` pozostaje publicznym wejściem do danych Pulpitu, a pomocnicza logika może zostać wydzielona do małego modułu domenowego, jeżeli zapobiegnie duplikacji między Prisma i JSON.
- `lib/ticket-filters.ts` obsługuje nowy parametr grupy etapów i grupy alarmowej oraz pozostaje kanonicznym miejscem parsowania filtrów URL.
- `lib/types.ts` opisuje nowy, ograniczony kontrakt Pulpitu.

Nie przewiduje się nowego endpointu API, server action ani zapisu danych z Pulpitu.

## Stany puste i błędy

- Brak alarmów pokazuje pozytywny komunikat `Brak krytycznych zgłoszeń i naruszeń SLA` zamiast pustej listy.
- Pusta zakładka osobistej kolejki pokazuje komunikat zależny od etapu, na przykład `Nie masz nowych zgłoszeń`.
- Brak danych wykresu pokazuje istniejący komunikat tekstowy zamiast pustej osi.
- Brak kategorii lub przypisań pokazuje mały stan pusty w odpowiednim module.
- Błąd pobrania całego kontraktu jest obsługiwany przez istniejący `app/admin/dashboard/error.tsx`. Pulpit nie renderuje częściowych liczników, które mogłyby opisywać różne momenty lub niekompletny stan.

## Dostępność i responsywność

- Zakładki osobistej kolejki używają semantyki `tablist`, `tab` i `tabpanel`, obsługują klawiaturę oraz mają widoczny focus.
- Alarmy nie polegają wyłącznie na kolorze; tekst zawsze wskazuje `Krytyczne` lub `SLA przekroczone`.
- Linki zgłoszeń mają czytelną nazwę zawierającą numer i tytuł.
- Wykresy zachowują tekstowe tytuły, legendę i stany puste.
- Na mobile sekcje układają się w jedną kolumnę, zakładki nie wychodzą poza szerokość ekranu, a listy nie używają wewnętrznego pionowego przewijania.
- Jasny i ciemny motyw zachowują wystarczający kontrast zgodnie z istniejącymi tokenami aplikacji.

## Testy

### Testy domenowe i danych

- identyczne wyniki agregacji dla providerów JSON i Prisma;
- liczenie otwartych zgłoszeń i średniego czasu rozwiązania w zakresie 30 dni;
- dokładnie 30 kolejnych dni danych wykresu, także dla dni bez zdarzeń;
- SLA z poprawnym `dueAt`, bez `dueAt` oraz z niepoprawną datą;
- wykluczenie statusów zakończonych z alarmów;
- deduplikacja zgłoszenia krytycznego po SLA i poprawna kolejność alarmów;
- mapowanie `NEW` i `TRIAGED` do `Nowe`, obu statusów oczekiwania do `Oczekujące` oraz `IN_PROGRESS` do `W realizacji`;
- pełne liczniki grup przy limicie pięciu rekordów;
- brak osobistych zgłoszeń innych agentów;
- parser i budowanie URL dla nowych filtrów grupowych.

### Testy komponentów i E2E

- domyślnie aktywna zakładka `Nowe`;
- przełączanie zakładek myszą i klawiaturą;
- maksymalnie pięć zgłoszeń oraz poprawny link `Zobacz wszystkie`;
- przejścia z liczników alarmowych do odpowiednio przefiltrowanej kolejki;
- stany puste każdej sekcji;
- dostęp dla AGENTA i ADMINA oraz przekierowanie pozostałych ról;
- układ bez poziomego przepełnienia na widoku mobilnym;
- brak regresji strony `Raporty` i kolejki `/admin/tickets`.

## Kryteria akceptacji

- Pierwszy ekran desktopowy pokazuje jednocześnie alarmy zespołu i osobistą kolejkę.
- Alarmy obejmują wyłącznie otwarte zgłoszenia krytyczne i po SLA, bez duplikatów.
- Osobista kolejka pokazuje trzy uzgodnione grupy, pełne liczniki i maksymalnie pięć rekordów aktywnej zakładki.
- Wszystkie odnośniki otwierają istniejące szczegóły lub kolejkę z poprawnymi filtrami.
- Analityka używa jednego, stałego zakresu ostatnich 30 dni.
- Pulpit nie zawiera osobnego rzędu czterech KPI ani sekcji ostatniej aktywności.
- Prisma i JSON zwracają semantycznie identyczny kontrakt.
- Pulpit jest użyteczny na desktopie i mobile, w jasnym i ciemnym motywie oraz za pomocą klawiatury.
- Testy typów, lint, testy danych i właściwe testy E2E przechodzą na Node 20.20.2.

## Poza zakresem

- nowy system powiadomień lub automatyczne przypisywanie zgłoszeń;
- alarmy dla zgłoszeń nieprzypisanych, blokujących pracę albo długo nieaktywnych;
- konfigurowalny okres analityki;
- nowe metryki raportowe lub przebudowa strony `Raporty`;
- zmiana reguł uprawnień panelu IT;
- zapisywanie preferowanej zakładki użytkownika;
- naprawa lub migracja historycznych danych `resolvedAt` istniejących przed tą zmianą;
- wdrożenie, commit implementacji lub push poza osobnym, wyraźnie zatwierdzonym etapem.
