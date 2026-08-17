/**
 * Centralizes the runtime data-storage provider selection.
 *
 * Both the data layer (`lib/data-store.ts`) and the health probe
 * (`app/api/health/route.ts`) must agree on which provider is active, so the
 * decision lives here instead of being duplicated.
 *
 * - `FIXIT_DATA_PROVIDER=json`   → always the JSON file store
 * - `FIXIT_DATA_PROVIDER=prisma` → always Prisma/PostgreSQL
 * - unset + `DATABASE_URL`       → Prisma in production, JSON otherwise
 */
export function shouldUsePrisma(): boolean {
  if (process.env.FIXIT_DATA_PROVIDER === "json") {
    return false;
  }

  if (process.env.FIXIT_DATA_PROVIDER === "prisma") {
    return true;
  }

  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
}
