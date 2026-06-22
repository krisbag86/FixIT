# Deployment - Railway

## 1. Rekomendacja

Dla MVP rekomendowany deployment:

- Aplikacja Next.js na Railway (Dockerfile deployment),
- PostgreSQL jako Railway service,
- Zmienne srodowiskowe w Railway Dashboard,
- Osobny projekt dla production,
- Opcjonalnie osobny projekt dla staging.

Stan na 2026-06-22:

- produkcyjny auto-deploy dziala po pushu na branch `main`,
- merge `v-1.1` -> `main` uruchomil deploy na Railway poprawnie,
- healthcheck aplikacji pozostaje oparty o `GET /api/health`.
- Railway korzysta z `DOCKERFILE` buildera z `railway.json`; runtime Node jest przypiety w repo do `20.20.2` przez `Dockerfile`, `.nvmrc`, `.node-version` i `package.json#engines`.
- Onboarding adminowski uzywa jednorazowych linkow aktywacyjnych. Jesli SMTP nie wysle wiadomosci, panel pokazuje awaryjny link i pozwala wygenerowac nowy link przy uzytkowniku.

## 2. Wymagane zmienne srodowiskowe

Aplikacja **nie używa NextAuth.js** - uzywa wlasnego cookie-based auth.
Nastepujace zmienne sa wymagane na Railway:

```env
# --- Wymagane ---
DATABASE_URL="postgresql://..."    # Railway PostgreSQL auto-injectuje to
APP_URL="https://twoja-aplikacja.railway.app"
NODE_ENV=production

# --- Wymagane do emaili ---
SMTP_HOST="smtp.example.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="nadawca@example.com"
SMTP_PASSWORD="twoje-haslo"
SMTP_TIMEOUT_MS="20000"
EMAIL_FROM="IT Helpdesk <it@bagietka.pl>"

# --- Opcjonalnie: Railway S3 Bucket do zalacznikow ---
# Bez tego zalaczniki sa przechowywane lokalnie i giną przy redeploy.
# S3_ENDPOINT="https://railway-bucket-url"
# S3_REGION="auto"
# S3_ACCESS_KEY_ID="..."
# S3_SECRET_ACCESS_KEY="..."
# S3_BUCKET="nazwa-bucketu"

# --- Tylko przy pierwszym deployu ---
# FIXIT_RUN_SEED=true
# FIXIT_BOOTSTRAP_ADMIN_EMAIL="admin@bagietka.pl"
# FIXIT_BOOTSTRAP_ADMIN_PASSWORD="silne-haslo-tymczasowe"
# Po bootstrapie usun te zmienne albo ustaw FIXIT_RUN_SEED=false.
```

## 3. Railway setup krok po kroku

### Krok 1: Utworz projekt Railway
1. Przejdz na https://railway.app
2. Kliknij "New Project"
3. Wybierz "Deploy from GitHub repo" i wybierz to repozytorium

### Krok 2: Dodaj PostgreSQL
1. W projekcie Railway kliknij "New" → "Database" → "Add PostgreSQL"
2. Railway automatycznie doda `DATABASE_URL` do zmiennych srodowiskowych aplikacji
3. Twoja aplikacja automatycznie uzyje SSL (obsluzone w `docker-entrypoint.sh`)

### Krok 3: Skonfiguruj zmienne srodowiskowe
W Railway Dashboard → project → Variables, ustaw:
- `APP_URL` = URL twojej aplikacji (np. `https://fixit.up.railway.app`)
- `NODE_ENV` = `production`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`

**Nie ustawiaj `NEXTAUTH_URL` ani `NEXTAUTH_SECRET`** - aplikacja nie uzywa NextAuth.

### Krok 4: Pierwszy deploy
1. Railway automatycznie zbuduje obraz Dockerem (DOCKERFILE builder z `railway.json`)
   - `Dockerfile` uzywa Node.js `20.20.2`
   - nie ustawiaj `RAILPACK_NODE_VERSION`, dopoki builderem pozostaje `DOCKERFILE`
2. `railway.json` wykonuje pre-deploy command:
   - `npx prisma migrate deploy`
3. `docker-entrypoint.sh` przy starcie kontenera:
   - Generuje klienta Prisma (`npx prisma generate`)
   - Wykonuje migracje (`npx prisma migrate deploy`)
   - Pomija seed, chyba ze ustawiono `FIXIT_RUN_SEED=true`

### Krok 5: Sprawdz czy dziala
- Odwiedz `https://twoja-aplikacja.railway.app/api/health` - powinien zwrocic JSON z `"status": "ok"` i `"database": "connected"`
- Zaloguj sie na `https://twoja-aplikacja.railway.app/login`

## 4. Co dziala automatycznie

| Mechanizm | Jak dziala |
|-----------|-----------|
| Auto-deploy | Railway obserwuje branch `main` w repo GitHub |
| Node runtime | `Dockerfile` buduje obraz na Node.js `20.20.2` |
| Pre-deploy | `railway.json` uruchamia `npx prisma migrate deploy` |
| Migracje Prisma | `docker-entrypoint.sh` uruchamia `prisma migrate deploy` przy starcie |
| Seed danych | `docker-entrypoint.sh` uruchamia `prisma db seed` tylko przy `FIXIT_RUN_SEED=true` |
| SSL do bazy | Entrypoint automatycznie dodaje `?sslmode=require` jesli brak |
| Healthcheck | Endpoint `GET /api/health` sprawdza baze i zwraca status |
| Data provider | Automatycznie wybiera Prisma gdy `NODE_ENV=production` i `DATABASE_URL` ustawiony |

## 5. Prisma w produkcji

W producji uzywamy:
```bash
npx prisma migrate deploy   # bezpieczne, idempotentne
```

Nie uzywamy:
```bash
npx prisma migrate dev      # NIE - to resetuje baze
```

Migracje sa uruchamiane automatycznie przez `railway.json` i dodatkowo przez `docker-entrypoint.sh`.
Nie ma potrzeby recznego uruchamiania migracji na Railway, chyba ze diagnozujesz awarie deployu.

## 5a. Auth i konta uzytkownikow

- Publiczna rejestracja jest dostepna pod `/register`.
- Rejestracja akceptuje tylko adresy z dokladnej domeny `bagietka.pl`.
- Samodzielna rejestracja tworzy aktywne konto `REPORTER`.
- Admin moze tworzyc konta recznie z `/admin/users`, nadawac role i wysylac jednorazowe linki aktywacyjne.
- Admin wysyla jednorazowy link aktywacyjny e-mailem. Haslo tymczasowe nie jest wysylane w tresci wiadomosci.
- Jesli SMTP jest skonfigurowane, panel admina wysle link automatycznie.
- Jesli SMTP nie jest skonfigurowane albo wysylka sie nie powiedzie, panel pokazuje awaryjny link aktywacyjny do recznego przekazania.
- Przy aktywnym koncie z `mustChangePassword=true` przycisk `Link` w `/admin/users` regeneruje token i ponawia wysylke.
- Usuniecie konta jest twarde tylko dla uzytkownikow bez historii. Konta z ticketami, komentarzami, artykulami, szablonami lub makrami nalezy dezaktywowac.

## 6. Zalaczniki i Railway

**Uwaga**: Railway ma **efemeryczny system plikow**. Wszystkie pliki zapisane lokalnie (.data/attachments/)
znikaja po kazdym redeploy.

Rozwiazania:
1. **Rekomendowane**: Skonfiguruj Railway Bucket (S3) - zobacz zmienne `S3_*` w sekcji 2.
2. **Tymczasowo**: Zalaczniki dzialaja do nastepnego deployu.

## 7. Checklist przed deployem

- [ ] `npm run lint` przechodzi
- [ ] `npm run typecheck` przechodzi
- [ ] `npm run test` przechodzi
- [ ] Lokalny runtime to Node.js `20.20.2` (`nvm use` albo Docker)
- [ ] Wszystkie env vars ustawione w Railway Dashboard
- [ ] `DATABASE_URL` wskazuje na Railway PostgreSQL (auto-injected)
- [ ] `NODE_ENV=production` ustawione
- [ ] `SMTP_*` skonfigurowane (jesli potrzebujesz powiadomien email)
- [ ] Railway Bucket S3 skonfigurowany (jesli potrzebujesz persistent zalacznikow)
- [ ] Domena `bagietka.pl` wymuszona po stronie serwera (dziala domyslnie)
- [ ] Healthcheck dziala: `GET /api/health` → `{"status":"ok","database":"connected"}`
- [ ] Publiczna rejestracja `/register` dziala dla `@bagietka.pl`
- [ ] Tworzenie usera z `/admin/users` wysyla mail poprawnie (jesli SMTP wlaczone)

## 8. Backupy i bezpieczenstwo

Przed uzyciem produkcyjnym warto ustalic:

- Backupy bazy - Railway robi automatyczne snapshoty PostgreSQL
- Retencja danych - domyslna polityka Railway
- Kto ma dostep do Railway
- Kto moze zmieniac env vars
- Jak odtworzyc system po awarii
- Jak eksportowac tickety (endpoint CSV w `/admin/reports`)

## 8. Najczestsze problemy i rozwiazania

| Problem | Przyczyna | Rozwiazanie |
|---------|-----------|-------------|
| App nie startuje, blad bazy | `DATABASE_URL` nie ustawiony lub bledny | Sprawdz zmienne w Railway Dashboard |
| Blad SSL przy laczniu z baza | Railway wymaga SSL | Entrypoint automatycznie dodaje `?sslmode=require` |
| Brak tabel po deployu | Migracje nie dzialaja | Sprawdz logi: `npx prisma migrate deploy` |
| Zalaczniki zniknely po redeploy | Brak S3 Bucket | Skonfiguruj Railway Bucket (zobacz sekcje 6) |
| Email nie dziala | Brak SMTP albo blad autoryzacji SMTP | Skonfiguruj SMTP w zmiennych srodowiskowych; do czasu naprawy uzyj awaryjnego linku aktywacyjnego w `/admin/users` |
| Email konczy sie `SMTP timeout` | Serwer SMTP nie odpowiada z Railway albo handshake trwa dluzej niz timeout | Sprawdz `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`; ustaw `SMTP_TIMEOUT_MS=20000` lub `30000`; jesli dalej timeout, provider/port jest niedostepny z Railway |
| Vitest/rolldown sypie bledem `node:util styleText` | Uruchomiono testy na Node 18 | Przelacz na Node.js `20.20.2` (`nvm use`) albo uruchom testy w Dockerze |
| Strona laduje sie bez danych | `FIXIT_DATA_PROVIDER` wymusza JSON | Usun zmienna lub ustaw na `prisma` |
| Push nie uruchamia deployu | Railway obserwuje inny branch | Sprawdz `Service -> Source` i ustaw auto-deploy z `main` |

## 9. Alternatywy

Alternatywy do Railway:

- Supabase + Vercel,
- Render,
- Fly.io,
- self-hosting na VPS.

Dla MVP Railway jest najprostszy, bo pozwala trzymac aplikacje i Postgresa w jednym projekcie.
