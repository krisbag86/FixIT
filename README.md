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

## Logowanie (magic link)

Logowanie odbywa się przez link wysyłany na email służbowy w domenie `bagietka.pl`:

1. Podaj email `@bagietka.pl` na ekranie logowania.
2. Aplikacja wysyła jednorazowy link (ważny 15 minut).
3. Kliknięcie linku potwierdza konto (pierwsze logowanie = założenie konta) i loguje.

Bez skonfigurowanego `RESEND_API_KEY` maile nie są wysyłane realnie — treść (w tym link do logowania) jest logowana do konsoli serwera, więc lokalny development działa bez konta Resend. Skopiuj link z logów i otwórz go w przeglądarce.

### Konta testowe (z seeda)

- `admin@bagietka.pl` - ADMIN
- `agent@bagietka.pl` - AGENT
- `sklep.waw01@bagietka.pl` - STORE_MANAGER
- `kasjer@bagietka.pl` - REPORTER

Logowanie akceptuje wyłącznie dokładną domenę `bagietka.pl`.

## Email i powiadomienia

Konfiguracja w `.env` (patrz `.env.example`):

- `RESEND_API_KEY` - klucz API Resend (gdy pusty, maile lecą do konsoli).
- `EMAIL_FROM` - nadawca, np. `FixIT Helpdesk <no-reply@bagietka.pl>` (domena musi być zweryfikowana w Resend).
- `APP_URL` - publiczny adres aplikacji do budowy linków w mailach.
- `MAGIC_LINK_TTL_MINUTES` - czas ważności linku logowania (domyślnie 15).

Powiadomienia email są wysyłane przy: potwierdzeniu konta / logowaniu, utworzeniu ticketu (do zgłaszającego oraz do IT), przypisaniu wykonawcy, nowym komentarzu publicznym i rozwiązaniu ticketu. Każda wysyłka jest zapisywana w `notification_logs` ze statusem `SENT`/`FAILED`.

## Walidacja

```bash
npm run lint
npm run typecheck
npm run test
```
