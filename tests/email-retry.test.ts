import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("email retry", () => {
  it("retries a failed send up to the bounded attempt limit", async () => {
    const { sendEmailWithRetry } = await import("@/lib/notifications");
    let attempts = 0;

    const result = await sendEmailWithRetry(
      async () => {
        attempts += 1;
        return attempts < 3 ? { ok: false, error: "temporary failure" } : { ok: true };
      },
      { maxAttempts: 3, delayMs: 0 }
    );

    expect(result).toEqual({ ok: true });
    expect(attempts).toBe(3);
  });
});
