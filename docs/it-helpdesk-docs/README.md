# IT Helpdesk App - Dokumentacja projektu

Dokumentacja startowa dla wewnetrznej aplikacji webowej do obslugi zgloszen IT dla sklepow i uzytkownikow biurowych Bagietki.

## Zawartosc

- `product-spec.md` - specyfikacja produktu, role, moduly i glowne przeplywy.
- `development-plan.md` - etapowy plan developmentu dla agentow AI.
- `agent-tasks.md` - gotowe taski/prompt templates dla agentow AI.
- `auth-security.md` - wymagania logowania, role, uprawnienia i ograniczenie domeny `bagietka.pl`.
- `database-schema.md` - proponowany model danych PostgreSQL/Prisma.
- `deployment-railway.md` - rekomendowany deployment na Railway.
- `docker-development.md` - lokalny development przez Docker Compose.
- `ux-flows.md` - glowne przeplywy UX dla uzytkownika i panelu IT.
- `testing-quality.md` - testy, kryteria akceptacji i eval-first workflow.
- `build-status.md` - aktualny status budowy aplikacji, rzeczy zrobione i pozostale.

## Rekomendowany stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Prisma
- PostgreSQL
- Railway
- Email provider: Resend, SMTP lub firmowy provider

## Glowny cel MVP

Pierwszy milestone powinien dostarczyc dzialajacy przeplyw:

```text
uzytkownik loguje sie mailem @bagietka.pl
-> tworzy ticket
-> IT widzi ticket w kolejce
-> IT przypisuje wykonawce i zmienia status
-> strony komentuja
-> system wysyla powiadomienia email
```

## Wazne zalozenia

- Logowanie tylko dla domeny `bagietka.pl`.
- Role: `REPORTER`, `STORE_MANAGER`, `AGENT`, `ADMIN`.
- Dark mode jest wymagany.
- MVP powinno byc proste, nowoczesne i mobile-friendly.
- Agenci AI powinni pracowac etapami, z testami i kryteriami akceptacji.
