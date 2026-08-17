# Reorganizacja nawigacji panelu IT

## Cel

Zmniejszyć wizualny tłok w panelu IT i skrócić drogę do dwóch najczęściej używanych narzędzi: DayLog oraz Grafik. Rzadziej używane funkcje administracyjne mają być dostępne z jednego, czytelnego miejsca.

## Zakres

Zmiana obejmuje wyłącznie frontendową nawigację i nową stronę `/admin/settings`. Istniejące adresy URL, akcje serwerowe, uprawnienia oraz zawartość stron pozostają bez zmian.

## Nawigacja panelu

`AdminNav` zostanie podzielony wizualnie na:

- podstawowe moduły: Pulpit, Zgłoszenia, Kanban, Baza wiedzy i Archiwum;
- wyróżnione narzędzia operacyjne: DayLog i Grafik;
- pojedynczy link `Ustawienia` prowadzący do `/admin/settings`.

DayLog i Grafik pozostaną zwykłymi linkami, ale dostaną mocniejszy akcent wizualny: delikatne tło, kolor mint oraz większy kontrast ikon. Nie będą automatycznie otwierać dodatkowych menu.

Aktywna pozycja będzie działać również dla podstron ustawień (`/admin/users`, `/admin/stores`, `/admin/categories`, `/admin/templates`, `/admin/reports`), aby użytkownik widział, że nadal znajduje się w grupie Ustawienia.

Układ zachowa obecne zachowanie responsywne: na małych ekranach nawigacja pozostanie poziomym przewijanym paskiem, ale kolejność nadal będzie zaczynać się od narzędzi operacyjnych.

## Strona Ustawienia

Nowa strona `/admin/settings` będzie korzystać z `AppShell` i `AdminNav`, a następnie pokaże kafelki linkujące do istniejących modułów:

- Raporty — dostępne dla użytkowników z dostępem do panelu IT;
- Użytkownicy — tylko administrator;
- Sklepy — tylko administrator;
- Kategorie — tylko administrator;
- Szablony — tylko administrator.

Kafelek zawiera ikonę, nazwę, jednozdaniowy opis i stan aktywności wynikający z istniejących uprawnień. Nie będzie żadnego nowego mechanizmu autoryzacji: strona i istniejące podstrony nadal filtrują dostęp po obecnych permission checks.

## Kryteria akceptacji

- W menu panelu nie ma już osobnych pozycji dla Użytkowników, Sklepów, Kategorii, Szablonów i Raportów.
- DayLog i Grafik są widoczne w pierwszej, wyróżnionej części nawigacji na desktopie i mobile.
- `/admin/settings` pokazuje tylko kafelki dostępne dla bieżącej roli.
- Link Ustawienia jest aktywny zarówno na `/admin/settings`, jak i na jego istniejących podstronach.
- Istniejące adresy modułów działają bez zmian.
- Testy obejmują renderowanie grup, aktywny stan oraz filtrowanie kafelków według roli.

## Poza zakresem

- przebudowa layoutu stron docelowych;
- zmiana uprawnień lub tras;
- zmiana głównej nawigacji użytkownika poza panelem IT;
- dodawanie nowych funkcji do modułów ustawień.
