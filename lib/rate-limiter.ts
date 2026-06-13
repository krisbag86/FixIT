/**
 * Sliding window rate limiter.
 *
 * In production (with Prisma/PostgreSQL), uses the database as a shared store
 * so rate limits work correctly across multiple server instances.
 *
 * In development/JSON mode, falls back to an in-memory Map.
 * For a fully production-grade setup, replace with Redis-based implementation.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const stores = new Map<string, RateLimitEntry>();

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

function shouldUsePrisma(): boolean {
  if (process.env.FIXIT_DATA_PROVIDER === "json") return false;
  if (process.env.FIXIT_DATA_PROVIDER === "prisma") return true;
  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
}

/**
 * Default configuration:
 * - Login: 5 attempts per 15 minutes
 * - Mutations: 20 requests per 1 minute
 */
export const RATE_LIMITS = {
  LOGIN: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
  MUTATION: { windowMs: 60 * 1000, maxAttempts: 20 },
} as const;

/**
 * Check if a request should be rate-limited.
 *
 * Uses the PostgreSQL database as a shared store when available (production),
 * or falls back to an in-memory store for development/JSON mode.
 *
 * @param key - Unique identifier for the client (e.g. "login:admin@bagietka.pl", "mutation:usr_123")
 * @param windowMs - Time window in milliseconds
 * @param maxAttempts - Maximum number of requests allowed in the window
 * @returns Object with allowed, remaining count, and reset time
 */
export async function checkRateLimit(
  key: string,
  windowMs: number = RATE_LIMITS.LOGIN.windowMs,
  maxAttempts: number = RATE_LIMITS.LOGIN.maxAttempts
): Promise<RateLimitResult> {
  const now = Date.now();

  if (shouldUsePrisma()) {
    return checkRateLimitDatabase(key, windowMs, maxAttempts, now);
  }

  // In-memory fallback (JSON/dev mode)
  return checkRateLimitMemory(key, windowMs, maxAttempts, now);
}

async function checkRateLimitDatabase(
  key: string,
  windowMs: number,
  maxAttempts: number,
  now: number
): Promise<RateLimitResult> {
  const { prisma } = await import("@/lib/prisma");

  // Use a transaction to prevent race conditions between concurrent requests
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.rateLimit.findUnique({ where: { key } });
    const timestamps: number[] = row ? (row.timestamps as number[]) : [];

    // Filter out timestamps outside the current window
    const valid = timestamps.filter((ts) => now - ts < windowMs);

    if (valid.length >= maxAttempts) {
      const oldest = valid[0];
      const resetInSeconds = Math.ceil((oldest + windowMs - now) / 1000);
      return { allowed: false as const, remaining: 0, resetInSeconds };
    }

    // Add current timestamp
    valid.push(now);

    await tx.rateLimit.upsert({
      where: { key },
      create: { key, timestamps: valid },
      update: { timestamps: valid }
    });

    return { allowed: true as const, remaining: maxAttempts - valid.length, resetInSeconds: 0 };
  });

  return result;
}

function checkRateLimitMemory(
  key: string,
  windowMs: number,
  maxAttempts: number,
  now: number
): RateLimitResult {
  let entry = stores.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    stores.set(key, entry);
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= maxAttempts) {
    const oldest = entry.timestamps[0];
    const resetInSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, resetInSeconds };
  }

  entry.timestamps.push(now);
  return { allowed: true, remaining: maxAttempts - entry.timestamps.length, resetInSeconds: 0 };
}

/**
 * Clear all rate limit data (useful for testing).
 * In Prisma mode, also clears the database table.
 */
export async function resetRateLimits(): Promise<void> {
  stores.clear();

  if (shouldUsePrisma()) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.rateLimit.deleteMany({});
  }
}

/**
 * Get the total number of tracked rate limit keys (useful for testing/metrics).
 * In Prisma mode, queries the database.
 */
export async function getRateLimitStoreSize(): Promise<number> {
  if (shouldUsePrisma()) {
    const { prisma } = await import("@/lib/prisma");
    return prisma.rateLimit.count();
  }

  return stores.size;
}
