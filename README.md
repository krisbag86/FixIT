# FixIT

Wewnętrzna aplikacja helpdesk IT dla sklepów i biura Bagietki.

## Start lokalny przez Docker

Rekomendowane:

```bash
docker compose up
```

Aplikacja uruchomi się pod `http://localhost:3001`. Compose startuje też PostgreSQL pod `localhost:5433`, choć aktualny pionowy MVP używa jeszcze lokalnego JSON-store.

## Start lokalny przez npm

```bash
npm install
npm run dev
```

Domyślna aplikacja używa lokalnego pliku `.data/fixit-db.json`, dzięki czemu pionowy plaster MVP działa bez konfiguracji Postgresa. Docelowy kontrakt bazy znajduje się w `prisma/schema.prisma`.

## Konta testowe

- `admin@bagietka.pl` - ADMIN
- `agent@bagietka.pl` - AGENT
- `sklep.waw01@bagietka.pl` - STORE_MANAGER
- `kasjer@bagietka.pl` - REPORTER

Logowanie akceptuje wyłącznie dokładną domenę `bagietka.pl`.

## Walidacja

```bash
npm run lint
npm run typecheck
npm run test
```
