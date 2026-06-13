import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimits, getRateLimitStoreSize, RATE_LIMITS } from "@/lib/rate-limiter";

describe("rate limiter", () => {
  beforeEach(async () => {
    await resetRateLimits();
  });

  it("allows requests within the limit", async () => {
    for (let i = 0; i < 5; i++) {
      const result = await checkRateLimit("test:user1", RATE_LIMITS.LOGIN.windowMs, 5);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5 - i - 1);
    }
  });

  it("blocks requests that exceed the limit", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("test:user2", RATE_LIMITS.LOGIN.windowMs, 5);
    }
    const result = await checkRateLimit("test:user2", RATE_LIMITS.LOGIN.windowMs, 5);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetInSeconds).toBeGreaterThan(0);
  });

  it("treats different keys separately", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("test:userA", RATE_LIMITS.LOGIN.windowMs, 5);
    }

    // userA should be blocked
    expect((await checkRateLimit("test:userA", RATE_LIMITS.LOGIN.windowMs, 5)).allowed).toBe(false);

    // userB should still be allowed
    expect((await checkRateLimit("test:userB", RATE_LIMITS.LOGIN.windowMs, 5)).allowed).toBe(true);
  });

  it("returns correct remaining count", async () => {
    const result1 = await checkRateLimit("test:remaining", 60_000, 10);
    expect(result1.remaining).toBe(9);

    const result2 = await checkRateLimit("test:remaining", 60_000, 10);
    expect(result2.remaining).toBe(8);
  });

  it("clears old timestamps after window expires", async () => {
    const windowMs = 100; // 100ms window for fast test

    // Fill up to the limit
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("test:expiry", windowMs, 3);
    }
    expect((await checkRateLimit("test:expiry", windowMs, 3)).allowed).toBe(false);

    // Wait for window to expire
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 150);
    });

    const result = await checkRateLimit("test:expiry", windowMs, 3);
    // After window expires, old timestamps are pruned and request is allowed
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // Just consumed one
  });

  it("resets all rate limit data", async () => {
    await checkRateLimit("test:reset1", 60_000, 5);
    await checkRateLimit("test:reset2", 60_000, 5);
    expect(await getRateLimitStoreSize()).toBe(2);

    await resetRateLimits();
    expect(await getRateLimitStoreSize()).toBe(0);

    // Previously blocked keys should work again
    expect((await checkRateLimit("test:reset1", 60_000, 5)).allowed).toBe(true);
  });

  it("allows high limits for mutation rate", async () => {
    for (let i = 0; i < 20; i++) {
      const result = await checkRateLimit("mutation:user", RATE_LIMITS.MUTATION.windowMs, RATE_LIMITS.MUTATION.maxAttempts);
      expect(result.allowed).toBe(true);
    }

    // 21st should be blocked
    expect((await checkRateLimit("mutation:user", RATE_LIMITS.MUTATION.windowMs, RATE_LIMITS.MUTATION.maxAttempts)).allowed).toBe(false);
  });

  it("handles single request correctly", async () => {
    const result = await checkRateLimit("test:single", 60_000, 1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);

    const result2 = await checkRateLimit("test:single", 60_000, 1);
    expect(result2.allowed).toBe(false);
  });
});
