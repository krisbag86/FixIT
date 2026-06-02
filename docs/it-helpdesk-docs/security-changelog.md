# Security Changelog — FixIT Helpdesk

> Dokumentacja wdrożonych zabezpieczeń. Aktualizowana z każdym etapem.

---

## P0 — Autoryzacja i hasła

### PBKDF2 hashowanie haseł

**Plik:** `lib/password.ts`

- Algorytm: **PBKDF2** z SHA-512, 100 000 iteracji
- Losowa sól (16 bajtów) dla każdego hasła
- Format przechowywania: `salt:hash` (hex-encoded)
- Weryfikacja z `timingSafeEqual` — odporna na ataki timingowe

```ts
hashPassword("admin123")  // → "a1b2...:3f4e..."
verifyPassword("admin123", stored)  // → true/false
```

### Model User z passwordHash

**Plik:** `prisma/schema.prisma`, `lib/types.ts`

- Pole `passwordHash String?` na modelu User
- Obecne w seedzie dla kont testowych (hash `admin123`)
- Użytkownicy bez hasła nie mogą się zalogować
- Brak auto-provisioningu — konto musi istnieć w DB z hashem

### Walidacja domeny email

**Plik:** `lib/email-domain.ts`

- Tylko dokładna domena `bagietka.pl` — subdomeny (np. `it.bagietka.pl`) odrzucone
- Normalizacja: `trim().toLowerCase()`
- Walidacja po stronie serwera (frontend tylko dla UX)

---

## P1 — Rate limiting, sanitizacja i sesje

### Rate limiting (sliding window)

**Plik:** `lib/rate-limiter.ts`

| Limiter | Okno | Max prób |
|---|---|---|
| **Login** | 15 minut | 5 |
| **Mutacje** (ticket, komentarz, itp.) | 1 minuta | 20 |

- In-memory sliding window — reset przy restarcie serwera
- Klucz: `login:{email}:{ip}` dla logowania, `mutation:{userId}` dla mutacji
- Zwraca `{ allowed, remaining, resetInSeconds }`

**Użycie:** `app/login/actions.ts` (login), `app/actions.ts` (mutacje)

### HTML escape w email templates

**Plik:** `lib/escape-html.ts`, `lib/email-templates.ts`

- Wszystkie dane użytkownika w szablonach maili przechodzą przez `escapeHtml()`
- Escapowane znaki: `&`, `<`, `>`, `"`, `'`
- Obejmuje: tytuł ticketu, opis, treść komentarza, email zgłaszającego, email wykonawcy
- Zapobiega HTML injection w treści maili

**Testy:** `tests/escape-html.test.ts` — 9 przypadków (wszystkie encje, polskie znaki, ciągi bezpieczne)

### CSV injection prevention

**Plik:** `lib/data-store.ts` (funkcja `escapeCSV`)

- Neutralizacja znaków formuł: `=`, `+`, `-`, `@` na początku wartości
- Poprzedzenie znakiem tabulacji (niewidoczny dla użytkownika, blokuje wykonanie formuły)
- Prawidłowe cytowanie wartości z przecinkami, cudzysłowami i znakami nowej linii

```ts
escapeCSV("=SUM(A1:A10)")  // → "\t=SUM(A1:A10)"
escapeCSV("normal")        // → "normal"
```

### Serwerowe sesje (opaque UUID)

**Plik:** `lib/session-store.ts`, `prisma/schema.prisma`

Zamiana stateless sesji (userId + HMAC w ciasteczku) na server-side opaque session ID.

#### Model Session

| Pole | Typ | Opis |
|---|---|---|
| `id` | UUID (PK) | Opaque session identifier |
| `userId` | FK → User | Właściciel sesji |
| `createdAt` | DateTime | Data utworzenia |
| `expiresAt` | DateTime | Data wygaśnięcia (14 dni) |

- Indeks na `userId` (szybkie wyszukiwanie sesji użytkownika)
- Indeks na `expiresAt` (szybkie czyszczenie wygasłych)
- CASCADE DELETE przy usunięciu użytkownika
- Obsługa obu trybów: Prisma (produkcja) i JSON-store (dev/test)

#### Właściwości

- Sesja wygasa po **14 dniach** (automatyczne czyszczenie przy odczycie)
- Logout faktycznie **unieważnia sesję** (usuwa z DB)
- **Dezaktywacja użytkownika** automatycznie unieważnia dostęp (`findUserById` filtruje `isActive: true`)
- Opaque UUID — brak informacji o użytkowniku w ciasteczku
- Brak HMAC, brak sekretu — sesja istnieje tylko w DB

**Przepływ:**
```
Login → createSession(userId) → cookie: sessionId (UUID)
Request → getSessionUser(sessionId) → findUserById(userId) → user
Logout → deleteSession(sessionId) → cookie deleted
```

### Czyszczenie — dead code i nieużywane zależności

- Usunięto `lib/cookie-signature.ts` — dead code (zastąpiony przez server-side session store)
- Usunięto `psql@0.0.1` z `package.json` — źródło 15 z 17 podatności npm audit
- Usunięto z `docker-compose.yml` nieużywane zmienne środowiskowe: `COOKIE_SECRET` (niepotrzebny po zmianie na server-side sessions), `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (NextAuth nie jest używany w projekcie)
- Wynik: **0 podatności** w `npm audit`

---

## P2 — Hardening API i HTTP

### Security headers (middleware)

**Plik:** `middleware.ts`

| Nagłówek | Wartość | Cel |
|---|---|---|
| `X-Frame-Options` | `DENY` | Ochrona przed clickjacking |
| `X-Content-Type-Options` | `nosniff` | Zapobiega MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Ogranicza wyciek referrera |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Wymusza HTTPS (2 lata) |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...` | Ogranicza źródła skryptów/stylów |

CSP obejmuje:
- `default-src 'self'` — domyślnie tylko własne źródła
- `script-src 'self' 'unsafe-inline' 'unsafe-eval'` — dozwolone skrypty z własnego serwera (Next.js wymaga inline)
- `style-src 'self' 'unsafe-inline'` — dozwolone style własne i inline
- `img-src 'self' data: blob:` — obrazy z własnego serwera, data URIs i blob
- `font-src 'self'` — czcionki tylko z własnego serwera
- `connect-src 'self'` — XHR/fetch tylko do własnego serwera
- `frame-ancestors 'none'` — blokada osadzania w iframe
- `base-uri 'self'` — ograniczenie ataków base tag injection
- `form-action 'self'` — formularze tylko do własnego serwera

### CSRF protection

**Plik:** `middleware.ts` (funkcja `isCSRFProtected`)

- Walidacja nagłówka **Origin** dla POST/PUT/PATCH/DELETE na `/api/*`
- Jeśli Origin brak — sprawdzany jest **Referer**
- Żądania bez Origin i Referer (curl, serwer → serwer) są przepuszczane
- Server actions mają wbudowaną ochronę CSRF (Next.js action IDs)

### Attachment serving

**Plik:** `app/api/attachments/[id]/route.ts`

- `Content-Disposition: attachment` zamiast `inline` — pliki nie wykonują się w przeglądarce
- `X-Content-Type-Options: nosniff` — blokada MIME sniffing
- `Cache-Control: private, max-age=0, must-revalidate` — brak cache dla wrażliwych plików
- Autoryzacja przed zwróceniem pliku: `getCurrentUser()` → `canViewTicket()`

### Health endpoint

**Plik:** `app/api/health/route.ts`

- Zwraca tylko `{ status: "ok" | "degraded" }`
- Usunięto: `uptime`, `timestamp`, szczegóły błędów DB
- Informacje o stanie bazy danych — tylko "connected" / "disconnected"

### Konfiguracja Next.js

**Plik:** `next.config.ts`

- `poweredByHeader: false` — ukrywa wersję Next.js przed potencjalnym atakującym
- `serverActions.bodySizeLimit: "2mb"` — limit rozmiaru body dla server actions (bezpieczeństwo przed DoS przez duże payloady)

### Hide version info

- `X-Powered-By` wyłączony
- Nagłówki nie ujawniają wersji Next.js, Node.js ani innych komponentów

---

## P3 — Docker hardening

### Non-root user

**Plik:** `Dockerfile`

- Kontener uruchamia się jako **`USER node`** (wbudowany użytkownik `node` z obrazu `node:20`)
- Wymagane dla uruchamiania na platformach wymagających non-root (np. Railway)
- Zmniejsza powierzchnię ataku (exploit nie ma od razu praw roota)

### Uprawnienia plików

- `chown -R node:node /app` — zapewnia zapisywalność:
  - `/app/.data` — JSON file store
  - `/app/node_modules/.prisma` — generowanie klienta Prisma w entrypoincie

### Production-only dependencies

- Osobna instalacja zależności w `runner` stage:
  - `deps` stage: wszystkie zależności (potrzebne do budowania)
  - `runner` stage: **tylko produkcyjne** (`npm ci --omit=dev`)
- Mniejszy obraz, mniejsza powierzchnia ataku
- Wygenerowany klient Prisma kopiowany z buildera

---

## Przegląd i testy

### Testy bezpieczeństwa

| Test | Plik | Zakres |
|---|---|---|
| escapeHtml | `tests/escape-html.test.ts` | 9 testów — wszystkie encje, double-escape, polskie znaki |
| Session store | `tests/session-store.test.ts` | 6 testów — create, lookup, invalid, delete, deactivated user, unique IDs |
| Password | `tests/password.test.ts` | hash, verify, wrong password, timing safety |
| Rate limiter | `tests/rate-limiter.test.ts` | sliding window, limit exceeded, reset |
| Email domain | `tests/email-domain.test.ts` | walidacja domeny bagietka.pl |
| Permissions | `tests/permissions.test.ts` | macierz uprawnień |

### npm audit

```bash
$ npm audit
# found 0 vulnerabilities
```

Status: **0 podatności** (po usunięciu `psql@0.0.1`)

---

## Podsumowanie — macierz zabezpieczeń

| Obszar | Status | Pliki |
|---|---|---|
| PBKDF2 hashowanie haseł | ✅ | `lib/password.ts` |
| Timing-safe weryfikacja | ✅ | `lib/password.ts` |
| Walidacja domeny email | ✅ | `lib/email-domain.ts` |
| Rate limiting (login) | ✅ | `lib/rate-limiter.ts`, `app/login/actions.ts` |
| Rate limiting (mutacje) | ✅ | `lib/rate-limiter.ts`, `app/actions.ts` |
| HTML escape w emailach | ✅ | `lib/escape-html.ts`, `lib/email-templates.ts` |
| CSV injection prevention | ✅ | `lib/data-store.ts` (escapeCSV) |
| Serwerowe sesje (UUID) | ✅ | `lib/session-store.ts`, `lib/auth.ts` |
| Logout unieważnia sesję | ✅ | `app/login/actions.ts` |
| Security headers (CSP, HSTS, XFO) | ✅ | `middleware.ts` |
| CSRF origin/referer check | ✅ | `middleware.ts` |
| Attachment: attachment+nosniff | ✅ | `app/api/attachments/[id]/route.ts` |
| Minimalny health endpoint | ✅ | `app/api/health/route.ts` |
| poweredByHeader ukryty | ✅ | `next.config.ts` |
| Docker non-root | ✅ | `Dockerfile` |
| Docker prod-only deps | ✅ | `Dockerfile` |
| 0 npm audit vulnerabilities | ✅ | `package.json` |
| Permissions (role-based) | ✅ | `lib/permissions.ts`, wszystkie route'y |
| Audit log admin akcji | ✅ | `lib/admin-utils.ts`, `lib/data-store.ts` |
| Automatyczne czyszczenie sesji | ✅ | `lib/session-store.ts` |
| CASCADE DELETE sesji przy usunięciu usera | ✅ | `prisma/schema.prisma` |
