# Deployment - Railway

## 1. Rekomendacja

Dla MVP rekomendowany deployment:

- aplikacja Next.js na Railway,
- PostgreSQL jako Railway service,
- zmienne srodowiskowe w Railway,
- osobny projekt dla production,
- opcjonalnie osobny projekt dla staging.

## 2. Wymagane zmienne srodowiskowe

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://twoja-aplikacja.railway.app"
NEXTAUTH_SECRET="change-me"
EMAIL_FROM="IT Helpdesk <it@bagietka.pl>"
EMAIL_PROVIDER_API_KEY="..."
APP_URL="https://twoja-aplikacja.railway.app"
```

Nazwy moga sie roznic w zaleznosci od finalnie wybranego auth/email providera.

## 3. Railway setup

Kroki:

1. Utworzyc projekt Railway.
2. Dodac service PostgreSQL.
3. Dodac service aplikacji z GitHub repo.
4. Podpiac `DATABASE_URL` z PostgreSQL do aplikacji.
5. Ustawic pozostale env vars.
6. Skonfigurowac build command.
7. Skonfigurowac start command.
8. Uruchomic migracje.
9. Sprawdzic logi.
10. Podpiac custom domain, jesli potrzebne.

## 4. Komendy

Build:

```bash
npm run build
```

Start:

```bash
npm run start
```

Migracje:

```bash
npx prisma migrate deploy
```

Seed, jesli potrzebny tylko jednorazowo:

```bash
npx prisma db seed
```

## 5. Prisma w produkcji

W produkcji uzywac:

```bash
npx prisma migrate deploy
```

Nie uzywac:

```bash
npx prisma migrate dev
```

## 6. Checklist przed deployem

- `npm run lint` przechodzi,
- `npm run typecheck` przechodzi,
- `npm run test` przechodzi,
- env vars sa ustawione,
- `DATABASE_URL` wskazuje produkcyjna baze,
- auth secret jest silny,
- domena `bagietka.pl` jest wymuszona po stronie serwera,
- maile testowe dzialaja,
- seed nie tworzy przypadkowych danych w produkcji bez kontroli.

## 7. Backupy i bezpieczenstwo

Przed uzyciem produkcyjnym warto ustalic:

- backupy bazy,
- retencje danych,
- kto ma dostep do Railway,
- kto moze zmieniac env vars,
- jak odtworzyc system po awarii,
- jak eksportowac tickety.

## 8. Alternatywy

Alternatywy do Railway:

- Supabase + Vercel,
- Render,
- Fly.io,
- self-hosting na VPS.

Dla MVP Railway jest najprostszy, bo pozwala trzymac aplikacje i Postgresa w jednym projekcie.
