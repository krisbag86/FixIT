import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_MS = 30_000;

export function generateMfaSecret(): string {
  const bytes = randomBytes(20);
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(buffer >>> bits) & 31];
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(secret: string): Buffer {
  const normalized = secret.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let buffer = 0;
  let bits = 0;
  const output: number[] = [];

  for (const character of normalized) {
    const value = BASE32_ALPHABET.indexOf(character);
    if (value < 0) {
      throw new Error("Nieprawidłowy sekret MFA.");
    }
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >>> bits) & 255);
    }
  }

  return Buffer.from(output);
}

export function generateTotpCode(secret: string, timestamp = Date.now()): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(timestamp / TOTP_STEP_MS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(value % 1_000_000).padStart(6, "0");
}

export function verifyTotpCode(secret: string, code: string, timestamp = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }

  try {
    const expectedCodes = [-1, 0, 1].map((offset) => generateTotpCode(secret, timestamp + offset * TOTP_STEP_MS));
    const candidate = Buffer.from(code);
    return expectedCodes.some((expected) => timingSafeEqual(candidate, Buffer.from(expected)));
  } catch {
    return false;
  }
}

export function getMfaOtpAuthUrl(email: string, secret: string): string {
  return `otpauth://totp/FixIT:${encodeURIComponent(email)}?secret=${secret}&issuer=FixIT&algorithm=SHA1&digits=6&period=30`;
}
