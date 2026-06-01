# Docker Development

Docker jest rekomendowanym trybem lokalnym dla FixIT, szczegolnie na Windows/WSL.

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

MVP uzywa lokalnego JSON-store w `.data/fixit-db.json`, zapisanego w wolumenie `fixit_data`. Serwis PostgreSQL jest dodany juz teraz, bo docelowy schemat Prisma znajduje sie w `prisma/schema.prisma` i bedzie kolejnym naturalnym etapem.

## Reset danych developerskich

```bash
docker compose down -v
```

Ta komenda usuwa wolumeny Dockera: lokalny store aplikacji, `node_modules` i baze PostgreSQL.
