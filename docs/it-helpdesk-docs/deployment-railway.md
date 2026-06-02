# Deployment - Railway

## 1. Rekomendacja

Dla MVP rekomendowany deployment:

- Aplikacja Next.js na Railway (Dockerfile deployment),
- PostgreSQL jako Railway service,
- Zmienne srodowiskowe w Railway Dashboard,
- Osobny projekt dla production,
- Opcjonalnie osobny projekt dla staging.

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
EMAIL_FROM="IT Helpdesk <it@bagietka.pl>"

# --- Opcjonalnie: Railway S3 Bucket do zalacznikow ---
# Bez tego zalaczniki sa przechowywane lokalnie i giną przy redeploy.
# S3_ENDPOINT="https://railway-bucket-url"
# S3_REGION="auto"
# S3_ACCESS_KEY_ID="..."
# S3_SECRET_ACCESS_KEY="..."
# S3_BUCKET="nazwa-bucketu"

# --- Tylko przy pierwszym deployu ---
# FIXIT_RUN_SEED=true   # odkomentuj, potem zakomentuj/usun
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
2. `docker-entrypoint.sh`:
   - Generuje klienta Prisma (`npx prisma generate`)
   - Wykonuje migracje (`npx prisma migrate deploy`)
3. Jesli to pierwszy deploy, ustaw `FIXIT_RUN_SEED=true` w Variables, a po udanym deployu **natychmiast usun** te zmienna

### Krok 5: Sprawdz czy dziala
- Odwiedz `https://twoja-aplikacja.railway.app/api/health` - powinien zwrocic JSON z `"status": "ok"` i `"database": "connected"`
- Zaloguj sie na `https://twoja-aplikacja.railway.app/login`

## 4. Co dziala automatycznie

| Mechanizm | Jak dziala |
|-----------|-----------|
| Migracje Prisma | `docker-entrypoint.sh` uruchamia `prisma migrate deploy` przy starcie |
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

Migracje sa uruchamiane automatycznie przez `docker-entrypoint.sh` przy kazdym starcie kontenera.
Nie ma potrzeby recznego uruchamiania migracji na Railway.

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
- [ ] Wszystkie env vars ustawione w Railway Dashboard
- [ ] `DATABASE_URL` wskazuje na Railway PostgreSQL (auto-injected)
- [ ] `NODE_ENV=production` ustawione
- [ ] `SMTP_*` skonfigurowane (jesli potrzebujesz powiadomien email)
- [ ] Railway Bucket S3 skonfigurowany (jesli potrzebujesz persistent zalacznikow)
- [ ] Domena `bagietka.pl` wymuszona po stronie serwera (dziala domyslnie)
- [ ] Healthcheck dziala: `GET /api/health` → `{"status":"ok","database":"connected"}`
- [ ] `FIXIT_RUN_SEED` usuniete po pierwszym seedzie

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
| Email nie dziala | Brak SMTP | Skonfiguruj SMTP w zmiennych srodowiskowych |
| Strona ladowana bez danych | `FIXIT_DATA_PROVIDER` wymusza JSON | Usun zmienna lub ustaw na `prisma` |

## 9. Alternatywy

Alternatywy do Railway:

- Supabase + Vercel,
- Render,
- Fly.io,
- self-hosting na VPS.

Dla MVP Railway jest najprostszy, bo pozwala trzymac aplikacje i Postgresa w jednym projekcie.
