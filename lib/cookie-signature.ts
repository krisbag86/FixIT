import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string | undefined {
  return process.env.COOKIE_SECRET;
}

/**
 * Sign a session value with an HMAC-SHA256 signature.
 * Falls back to raw value if COOKIE_SECRET is not set (backward compat).
 */
export function signSessionValue(value: string): string {
  const secret = getSecret();
  if (!secret) {
    return value;
  }

  const hmac = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${hmac}`;
}

/**
 * Verify a signed session value.
 * Returns the original value if valid, or undefined if tampered.
 * Falls back to raw value if COOKIE_SECRET is not set.
 */
export function verifySessionValue(signed: string): string | undefined {
  const secret = getSecret();

  // If no secret configured, return value as-is (backward compat)
  if (!secret) {
    return signed || undefined;
  }

  const lastDot = signed.lastIndexOf(".");
  if (lastDot === -1) {
    return undefined;
  }

  const value = signed.slice(0, lastDot);
  const signature = signed.slice(lastDot + 1);

  if (!value || !signature) {
    return undefined;
  }

  const expected = createHmac("sha256", secret).update(value).digest("hex");

  try {
    const isValid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    return isValid ? value : undefined;
  } catch {
    // Buffers of different lengths
    return undefined;
  }
}
