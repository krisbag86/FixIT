import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits, getRateLimitStoreSize, RATE_LIMITS } from "@/lib/rate-limiter";

describe("rate limiter", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("allows requests within the limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("test:user1", RATE_LIMITS.LOGIN.windowMs, 5);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5 - i - 1);
    }
  });

  it("blocks requests that exceed the limit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test:user2", RATE_LIMITS.LOGIN.windowMs, 5);
    }
    const result = checkRateLimit("test:user2", RATE_LIMITS.LOGIN.windowMs, 5);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetInSeconds).toBeGreaterThan(0);
  });

  it("treats different keys separately", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test:userA", RATE_LIMITS.LOGIN.windowMs, 5);
    }

    // userA should be blocked
    expect(checkRateLimit("test:userA", RATE_LIMITS.LOGIN.windowMs, 5).allowed).toBe(false);

    // userB should still be allowed
    expect(checkRateLimit("test:userB", RATE_LIMITS.LOGIN.windowMs, 5).allowed).toBe(true);
  });

  it("returns correct remaining count", () => {
    const result1 = checkRateLimit("test:remaining", 60_000, 10);
    expect(result1.remaining).toBe(9);

    const result2 = checkRateLimit("test:remaining", 60_000, 10);
    expect(result2.remaining).toBe(8);
  });

  it("clears old timestamps after window expires", () => {
    const windowMs = 100; // 100ms window for fast test

    // Fill up to the limit
    for (let i = 0; i < 3; i++) {
      checkRateLimit("test:expiry", windowMs, 3);
    }
    expect(checkRateLimit("test:expiry", windowMs, 3).allowed).toBe(false);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = checkRateLimit("test:expiry", windowMs, 3);
        // After window expires, old timestamps are pruned and request is allowed
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2); // Just consumed one
        resolve();
      }, 150);
    });
  });

  it("resets all rate limit data", () => {
    checkRateLimit("test:reset1", 60_000, 5);
    checkRateLimit("test:reset2", 60_000, 5);
    expect(getRateLimitStoreSize()).toBe(2);

    resetRateLimits();
    expect(getRateLimitStoreSize()).toBe(0);

    // Previously blocked keys should work again
    expect(checkRateLimit("test:reset1", 60_000, 5).allowed).toBe(true);
  });

  it("allows high limits for mutation rate", () => {
    for (let i = 0; i < 20; i++) {
      const result = checkRateLimit("mutation:user", RATE_LIMITS.MUTATION.windowMs, RATE_LIMITS.MUTATION.maxAttempts);
      expect(result.allowed).toBe(true);
    }

    // 21st should be blocked
    expect(checkRateLimit("mutation:user", RATE_LIMITS.MUTATION.windowMs, RATE_LIMITS.MUTATION.maxAttempts).allowed).toBe(false);
  });

  it("handles single request correctly", () => {
    const result = checkRateLimit("test:single", 60_000, 1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);

    const result2 = checkRateLimit("test:single", 60_000, 1);
    expect(result2.allowed).toBe(false);
  });
});
