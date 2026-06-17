import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";

const TOKEN_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours
const TOKEN_BYTES = 32;

function shouldUsePrisma(): boolean {
  if (process.env.FIXIT_DATA_PROVIDER === "json") return false;
  if (process.env.FIXIT_DATA_PROVIDER === "prisma") return true;
  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isExpired(expiresAt: Date | string): boolean {
  return new Date() > new Date(expiresAt);
}

async function getPrisma() {
  return (await import("@/lib/prisma")).prisma;
}

/**
 * Generate an opaque, single-use setup token for a user onboarding link.
 *
 * Only a SHA-256 hash is persisted, so a database leak does not reveal usable
 * setup links. The raw token is returned once for the invitation email.
 */
export async function createSetupToken(email: string): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_DURATION_MS);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    await db.setupToken.create({
      data: {
        tokenHash,
        email,
        expiresAt,
        createdAt: now
      }
    });
    return token;
  }

  const { withDatabase } = await import("@/lib/data-store");
  await withDatabase((database) => {
    database.setupTokens.push({
      id: `setup_${randomUUID().slice(0, 8)}`,
      tokenHash,
      email,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString()
    });
  });

  return token;
}

/**
 * Validate a setup token without consuming it. Used by the setup page to show
 * the account email before the user submits a new password.
 */
export async function verifySetupToken(token: string): Promise<string | null> {
  if (!token || token.length > 256) return null;

  const tokenHash = hashToken(token);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const row = await db.setupToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt || isExpired(row.expiresAt)) return null;
    return row.email;
  }

  const { readDatabase } = await import("@/lib/data-store");
  const database = await readDatabase();
  const row = database.setupTokens.find((item) => item.tokenHash === tokenHash);
  if (!row || row.usedAt || isExpired(row.expiresAt)) return null;
  return row.email;
}

/**
 * Consume a setup token exactly once and return the associated email.
 */
export async function consumeSetupToken(token: string): Promise<string | null> {
  if (!token || token.length > 256) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    return db.$transaction(async (tx) => {
      const row = await tx.setupToken.findUnique({ where: { tokenHash } });
      if (!row || row.usedAt || isExpired(row.expiresAt)) return null;

      await tx.setupToken.update({
        where: { tokenHash },
        data: { usedAt: now }
      });

      return row.email;
    });
  }

  const { withDatabase } = await import("@/lib/data-store");
  let email: string | null = null;
  await withDatabase((database) => {
    const row = database.setupTokens.find((item) => item.tokenHash === tokenHash);
    if (!row || row.usedAt || isExpired(row.expiresAt)) return;

    row.usedAt = now.toISOString();
    email = row.email;
  });

  return email;
}
