import { describe, expect, it } from "vitest";
import { checkMagicToken, generateMagicToken } from "@/lib/magic-link";
import type { MagicToken } from "@/lib/types";

function buildToken(overrides: Partial<MagicToken> = {}): MagicToken {
  return {
    token: "abc",
    email: "jan@bagietka.pl",
    isNewAccount: true,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides
  };
}

describe("checkMagicToken", () => {
  const nowMs = Date.now();

  it("returns not-found for missing token", () => {
    expect(checkMagicToken(undefined, nowMs)).toBe("not-found");
  });

  it("returns valid for a fresh unused token", () => {
    expect(checkMagicToken(buildToken(), nowMs)).toBe("valid");
  });

  it("returns used for a consumed token", () => {
    expect(checkMagicToken(buildToken({ usedAt: new Date().toISOString() }), nowMs)).toBe("used");
  });

  it("returns expired for a token past its expiry", () => {
    expect(checkMagicToken(buildToken({ expiresAt: new Date(nowMs - 1000).toISOString() }), nowMs)).toBe("expired");
  });
});

describe("generateMagicToken", () => {
  it("creates a unique 64-char hex token", () => {
    const first = generateMagicToken();
    const second = generateMagicToken();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });
});
