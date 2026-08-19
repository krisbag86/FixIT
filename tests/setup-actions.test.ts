import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  hashPassword: vi.fn(() => "hashed"),
  consumeSetupToken: vi.fn(async () => null),
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 4, resetInSeconds: 0 }))
}));

vi.mock("@/lib/password", () => ({ hashPassword: mocks.hashPassword }));
vi.mock("@/lib/setup-token", () => ({ consumeSetupToken: mocks.consumeSetupToken }));
vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: mocks.checkRateLimit,
  RATE_LIMITS: { LOGIN: { windowMs: 900_000, maxAttempts: 5 } }
}));
vi.mock("@/lib/data-store", () => ({ recordSecurityAudit: vi.fn() }));

afterEach(() => {
  mocks.hashPassword.mockClear();
  mocks.consumeSetupToken.mockClear();
  mocks.checkRateLimit.mockClear();
});

describe("setup password action", () => {
  it("rejects an invalid token before hashing the submitted password", async () => {
    const { setupPasswordAction } = await import("@/app/setup/actions");
    const formData = new FormData();
    formData.set("token", "invalid-token");
    formData.set("password", "VeryStrongPassword123!");
    formData.set("confirmPassword", "VeryStrongPassword123!");

    await expect(setupPasswordAction(undefined, formData)).resolves.toBe(
      "Link jest nieprawidłowy lub wygasł. Skontaktuj się z administratorem."
    );
    expect(mocks.consumeSetupToken).toHaveBeenCalledWith("invalid-token");
    expect(mocks.hashPassword).not.toHaveBeenCalled();
  });
});
