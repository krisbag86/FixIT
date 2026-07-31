# Docker Development

Docker jest rekomendowanym trybem lokalnym dla FixIT, szczegolnie na Windows/WSL.

Aktualny runtime projektu: Node.js `20.20.2`.

## Dlaczego Docker

- izoluje wersje Node.js i npm,
- uruchamia aplikacje i PostgreSQL jedna komenda,
- zmniejsza roznice miedzy lokalnym developmentem a Railway,
- pozwala trzymac `node_modules` poza systemem hosta,
- ulatwia przyszle przejscie z lokalnego JSON-store na Prisma/PostgreSQL.

## Start

```bash
docker compose up
```

`docker-compose.yml` uzywa obrazu `node:20.20.2-bookworm-slim`, czyli tej samej wersji Node co produkcyjny `Dockerfile`.

Aplikacja bedzie dostepna pod:

```text
http://localhost:3001
```

PostgreSQL bedzie wystawiony lokalnie pod:

```text
localhost:5433
```

Wewnatrz sieci Dockera aplikacja uzywa:

```text
postgres:5432
```

## Obecny stan danych

Docker Compose uruchamia aplikacje w trybie Prisma/PostgreSQL, tak jak runtime produkcyjny. PostgreSQL dziala w serwisie `postgres`, a dane sa przechowywane w wolumenie `postgres_data`.

JSON-store w `.data/fixit-db.json` pozostaje fallbackiem developerskim, gdy aplikacja nie ma `DATABASE_URL` albo ma ustawione `FIXIT_DATA_PROVIDER=json`.

## Prisma w kontenerze

`docker compose up` uruchamia przed aplikacja dwa jednorazowe joby:

- `migrate` - wykonuje `npm run db:migrate:deploy`,
- `seed` - wykonuje `npm run db:generate` i `npm run db:seed`.

Te joby przygotowuja baze PostgreSQL przed uruchomieniem aplikacji. Serwis `app` ma ustawione `FIXIT_DATA_PROVIDER=prisma`, wiec lokalny Docker korzysta z tego samego storage runtime co produkcja.

Lokalny admin bootstrapowy to `admin@bagietka.pl` z haslem `admin1234`. Po pierwszym logowaniu aplikacja wymusza zmiane hasla.

## Reset danych developerskich

```bash
docker compose down -v
```

Ta komenda usuwa wolumeny Dockera: lokalny store aplikacji, `node_modules` i baze PostgreSQL.
