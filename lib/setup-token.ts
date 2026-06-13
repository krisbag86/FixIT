import "server-only";

import { createHmac } from "node:crypto";

/**
 * Creates a signed, time-limited setup token for new user onboarding.
 *
 * The token encodes the user's email and expiry timestamp, signed with an
 * HMAC-SHA256 key derived from the COOKIE_SECRET. The token is stateless
 * (no database storage needed) and self-validating.
 *
 * Format (base64url-encoded):
 *   email:expiry:hmac
 */

function getSecret(): string {
  return process.env.COOKIE_SECRET || "fixit-setup-fallback-change-in-production";
}

const TOKEN_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours

export interface SetupTokenPayload {
  email: string;
  expiry: number;
}

/**
 * Generate a signed setup token for a given email.
 * The token expires after 48 hours.
 */
export function createSetupToken(email: string): string {
  const secret = getSecret();
  const expiry = Date.now() + TOKEN_DURATION_MS;
  const payload = `${email}:${expiry}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  const token = `${payload}:${hmac}`;
  return Buffer.from(token, "utf-8").toString("base64url");
}

/**
 * Verify and decode a setup token.
 * Returns the email if valid, or null if the token is expired or tampered with.
 */
export function verifySetupToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const separatorIndex = decoded.lastIndexOf(":");
    if (separatorIndex === -1) return null;

    const hmac = decoded.slice(separatorIndex + 1);
    const payload = decoded.slice(0, separatorIndex);

    const payloadParts = payload.split(":");
    if (payloadParts.length < 2) return null;

    const expiry = Number(payloadParts.pop());
    const email = payloadParts.join(":");

    if (Number.isNaN(expiry) || Date.now() > expiry) return null;

    const secret = getSecret();
    const expectedHmac = createHmac("sha256", secret).update(payload).digest("hex");

    if (hmac !== expectedHmac) return null;

    return email;
  } catch {
    return null;
  }
}
