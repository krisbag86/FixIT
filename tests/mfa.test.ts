import { describe, expect, it } from "vitest";
import { generateMfaSecret, generateTotpCode, getMfaOtpAuthUrl, verifyTotpCode } from "@/lib/mfa";

describe("TOTP MFA", () => {
  it("matches the RFC-compatible six-digit code at a fixed timestamp", () => {
    expect(generateTotpCode("JBSWY3DPEHPK3PXP", 0)).toBe("282760");
  });

  it("accepts the adjacent time window and rejects malformed codes", () => {
    const timestamp = 1_700_000_000_000;
    const secret = "JBSWY3DPEHPK3PXP";
    const code = generateTotpCode(secret, timestamp);

    expect(verifyTotpCode(secret, code, timestamp + 30_000)).toBe(true);
    expect(verifyTotpCode(secret, "123", timestamp)).toBe(false);
    expect(verifyTotpCode(secret, "000000", timestamp)).toBe(false);
  });

  it("generates an authenticator-compatible setup URI", () => {
    const secret = generateMfaSecret();
    const uri = getMfaOtpAuthUrl("admin@bagietka.pl", secret);

    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(uri).toContain("otpauth://totp/FixIT:admin%40bagietka.pl");
    expect(uri).toContain(`secret=${secret}`);
  });
});
