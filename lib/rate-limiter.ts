/**
 * In-memory sliding window rate limiter.
 *
 * Tracks request timestamps per key (e.g. IP+email for login, userId for mutations).
 * Uses a simple Map – resets on server restart (acceptable for an internal IT tool).
 *
 * For production with multiple instances, replace with Redis-based implementation.
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
 * @param key - Unique identifier for the client (e.g. "login:admin@bagietka.pl", "mutation:usr_123")
 * @param windowMs - Time window in milliseconds
 * @param maxAttempts - Maximum number of requests allowed in the window
 * @returns Object with allowed, remaining count, and reset time
 */
export function checkRateLimit(
  key: string,
  windowMs: number = RATE_LIMITS.LOGIN.windowMs,
  maxAttempts: number = RATE_LIMITS.LOGIN.maxAttempts
): RateLimitResult {
  const now = Date.now();
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
 */
export function resetRateLimits(): void {
  stores.clear();
}

/**
 * Get store size (useful for testing/metrics).
 */
export function getRateLimitStoreSize(): number {
  return stores.size;
}
