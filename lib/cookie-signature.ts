import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "COOKIE_SECRET must be set and at least 16 characters long in production. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return secret;
}

/**
 * Sign a session value with an HMAC-SHA256 signature.
 */
export function signSessionValue(value: string): string {
  const secret = getSecret();
  const hmac = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${hmac}`;
}

/**
 * Verify a signed session value.
 * Returns the original value if valid, or undefined if tampered.
 */
export function verifySessionValue(signed: string): string | undefined {
  const secret = getSecret();

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
