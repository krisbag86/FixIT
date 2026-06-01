# FixIT — benchmark rynkowy i propozycje funkcji

Porównanie FixIT z popularnymi systemami helpdesk/ITSM oraz rekomendacje, co warto wdrożyć, dopasowane do kontekstu sieci sklepów Bagietka (POS, drukarki fiskalne, terminale płatnicze).

## 1. Analizowane systemy

| System | Typ | Mocne strony |
|---|---|---|
| **Zendesk** | SaaS, customer service | Omnichannel, AI agents, najbogatszy portal klienta |
| **Freshservice** | SaaS, ITSM | Najłatwiejszy wdrożeniowo, asset management, ITIL |
| **Jira Service Management** | SaaS, ITSM | Integracja z dev (Jira), change/incident, free tier |
| **Zammad / osTicket / FreeScout** | Open source, helpdesk | Email-to-ticket, SLA, self-host, niskie koszty |
| **GLPI** | Open source, ITSM+CMDB | Inwentaryzacja zasobów, CMDB, finanse, helpdesk |

## 2. Co FixIT już ma

- Magic-link login z restrykcją domeny `@bagietka.pl`, role (REPORTER / STORE_MANAGER / AGENT / ADMIN).
- Tickety (`IT-YYYY-NNNN`), priorytety (LOW…CRITICAL), flaga `blocksWork`, statusy w tym `WAITING_FOR_USER` i `WAITING_FOR_VENDOR`.
- Portal zgłaszającego + panel IT (kolejka, filtry, metryki), zmiana statusu/priorytetu/assignee.
- Komentarze publiczne + notatki wewnętrzne, timeline zdarzeń.
- Powiadomienia email per zdarzenie (Resend + fallback do logu), `notification_logs` (SENT/FAILED).
- Pola pod SLA i bazę wiedzy już w modelu: `dueAt`, `resolvedAt`, typ `KnowledgeArticle` (bez UI).

## 3. Luki względem rynku (czego brakuje)

Standard, który mają niemal wszystkie systemy, a FixIT nie:

1. **Baza wiedzy / FAQ (self-service)** — deflekcja powtarzalnych zgłoszeń. Typ `KnowledgeArticle` istnieje, brak UI/wyszukiwarki.
2. **SLA + eskalacje** — polityki czasu reakcji/rozwiązania wg priorytetu, liczone w godzinach pracy; auto-eskalacja przy zbliżaniu się deadline. `dueAt` jest, brak logiki i alertów.
3. **Automatyzacje / reguły routingu** — auto-przypisanie wg kategorii/sklepu, auto-priorytet, triggery („CRITICAL + blocksWork → natychmiast do dyżurnego").
4. **CSAT / ankieta po rozwiązaniu** — ocena satysfakcji (1–5) w mailu o rozwiązaniu; raport jakości.
5. **Asset management / CMDB** — rejestr urządzeń per sklep (POS, drukarka fiskalna, terminal, waga) z numerem seryjnym, gwarancją, dostawcą. Powiązanie ticketu z urządzeniem.
6. **Email-to-ticket** — zakładanie zgłoszeń z przychodzącego maila (nie tylko z portalu).
7. **Kanban / „Moje zadania"** — tablica po statusach, widok przypisanych do agenta.
8. **Raporty / dashboard / eksport CSV** — wolumen, MTTR, SLA compliance, ranking kategorii/sklepów.
9. **Załączniki** — `TicketAttachment` jest w schemacie Prisma, brak runtime/UI (zrzuty ekranu błędów to podstawa).
10. **Canned responses / makra** — szablony odpowiedzi dla powtarzalnych przypadków.
11. **Multichannel notyfikacje** — poza email: Slack/Teams/SMS dla CRITICAL.
12. **Godziny pracy / dyżury (on-call)** — kalendarz wsparcia, do liczenia SLA i eskalacji.
13. **Problem & Change management (ITIL)** — łączenie wielu incydentów w jeden problem; rejestr zmian.

## 4. Propozycje dopasowane do sieci sklepów (wyróżniki)

Funkcje, które dają największą wartość akurat dla helpdesku retail/POS:

- **Rejestr urządzeń per sklep + QR na sprzęcie** — naklejka QR na kasie/drukarce; skan otwiera formularz z już wypełnionym sklepem i urządzeniem. Skraca zgłoszenie do kilku sekund dla kasjera.
- **Szybkie szablony zgłoszeń** dla typowych awarii: „kasa nie drukuje paragonu", „terminal offline", „brak połączenia z centralą", „drukarka fiskalna — błąd". Auto-kategoria i priorytet.
- **Fast-track dla blokady sprzedaży** — `blocksWork=true` → automatycznie CRITICAL, krótkie SLA, alert na Slack/SMS do dyżurnego. (Częściowo jest: flaga + CRITICAL; brak SLA/alertu.)
- **Eskalacja do serwisu zewnętrznego (dostawcy)** — status `WAITING_FOR_VENDOR` już istnieje; dodać kontakty dostawców, numer zgłoszenia u dostawcy i licznik czasu po stronie vendora.
- **Raport awaryjności wg sklepu/urządzenia** — wykrywanie powtarzalnych usterek sprzętu (kandydaci do wymiany), widoczność dla zarządu sieci.
- **PWA / widok mobilny** — kasjerzy zgłaszają z telefonu na zapleczu; instalowalne na ekranie głównym.

## 5. Rekomendowana kolejność wdrożeń

**Najpierw fundament produkcyjny (z `remaining_tasks.md`):** realny Resend + weryfikacja domeny, migracja na Prisma/PostgreSQL. Bez tego reszta nie pójdzie na produkcję.

Następnie wg wartość/koszt:

| # | Funkcja | Wartość | Koszt | Priorytet |
|---|---|---|---|---|
| 1 | Baza wiedzy / FAQ | wysoka (deflekcja) | śr. | P1 |
| 2 | SLA + eskalacje (na `dueAt`) | wysoka | śr. | P1 |
| 3 | Załączniki (zrzuty błędów) | wysoka | niski | P1 |
| 4 | „Moje zadania" + kanban | śr.-wys. | niski | P1 |
| 5 | Raporty/dashboard + CSV | wysoka (zarząd) | śr. | P1 |
| 6 | Rejestr urządzeń per sklep + QR | wysoka (retail) | wyższy | P1/P2 |
| 7 | Szablony zgłoszeń + auto-routing | śr.-wys. | niski | P2 |
| 8 | CSAT po rozwiązaniu | śr. | niski | P2 |
| 9 | Alerty Slack/SMS dla CRITICAL | śr. | niski | P2 |
| 10 | Email-to-ticket | śr. | wyższy | P2 |
| 11 | PWA / mobile | śr. | śr. | P2 |
| 12 | Problem/Change (ITIL) | niska (na teraz) | wysoki | P3 |

**Szybkie wygrane (małe, duży efekt):** załączniki, „Moje zadania", szablony zgłoszeń, CSAT, alerty Slack/SMS.

**Strategiczny wyróżnik dla sieci:** rejestr urządzeń per sklep z QR — to czego nie da pudełkowy helpdesk bez dużej konfiguracji, a u Was wprost adresuje realny ból (POS/fiskalne).
