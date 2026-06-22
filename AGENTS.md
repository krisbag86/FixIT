# FixIT Agents Guide

## Development

**Recommended:** Use Docker for local development — isolates Node.js versions and includes PostgreSQL.
```bash
docker compose up
# App: http://localhost:3001
# DB: localhost:5433 (internal: postgres:5432)
```
Docker and Railway are pinned to Node.js 20.20.2. Without Docker, run `nvm use` first.

**Without Docker:**
```bash
nvm use
npm install
npm run db:generate
npm run dev
```

## Validation Commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint . --max-warnings=0
npm run test        # TMPDIR=/tmp vitest run
npm run test:e2e    # TMPDIR=/tmp playwright test (start dev server manually)
```

## Data Provider

The app uses dual storage—JSON file (dev/fallback) or Prisma/PostgreSQL. Controlled by `FIXIT_DATA_PROVIDER`:
- `prisma` — force Prisma (production mode)
- `json` — force JSON file
- Not set + `DATABASE_URL` — auto-selects Prisma in production

## Key Constraints

- **Authentication:** Only `@bagietka.pl` emails are allowed
- **Permissions:** Check `lib/permissions.ts` — REPORTER/STORE_MANAGER/AGENT/ADMIN roles
- **Ticket numbers:** Format `IT-YYYY-NNNN` (see `lib/ticket-number.ts`)
- **Internal notes:** Never exposed to users with `visibility: PUBLIC` filter
- **Admin protection:** Cannot delete the last active admin (enforced in `lib/data-store.ts`)
- **Admin invites:** Setup links are one-time tokens. If SMTP fails, `/admin/users` shows a fallback activation link and the `Link` button can regenerate a token for active users with `mustChangePassword=true`.
- **Email provider:** Prefer Brevo API via `BREVO_API_KEY` on Railway; SMTP can timeout from cloud networks.
- **User deletion:** Hard delete is allowed only for users without historical records; users with tickets/comments/content should be deactivated.

## Deployment

Railway deployment uses `docker-entrypoint.sh` which:
1. Validates `DATABASE_URL`
2. Appends `sslmode=require` for Railway PostgreSQL
3. Runs Prisma migrate deploy + seed
4. Starts the app

Reset Docker volumes: `docker compose down -v`
