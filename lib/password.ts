import { randomBytes, pbkdf2Sync, timingSafeEqual } from "node:crypto";

const ITERATIONS = 100_000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";
const SALT_LENGTH = 16;
const TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

/**
 * Hash a password using PBKDF2 with a random salt.
 * Returns a string in format "salt:hash" (both hex-encoded).
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `${salt}:${hash}`;
}

export function generateTemporaryPassword(length = 14): string {
  let password = "";
  const bytes = randomBytes(length);

  for (let index = 0; index < length; index += 1) {
    password += TEMP_PASSWORD_CHARS[bytes[index] % TEMP_PASSWORD_CHARS.length];
  }

  return password;
}

/**
 * Verify a password against a stored "salt:hash" string.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const colonIndex = stored.indexOf(":");
  if (colonIndex === -1) return false;

  const salt = stored.slice(0, colonIndex);
  const hash = stored.slice(colonIndex + 1);

  if (!salt || !hash) return false;

  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");

  try {
    return timingSafeEqual(Buffer.from(derived), Buffer.from(hash));
  } catch {
    // Buffers of different lengths
    return false;
  }
}
