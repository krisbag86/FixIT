import type { MagicToken } from "@/lib/types";

const defaultTtlMinutes = 15;

export function magicLinkTtlMinutes(): number {
  const raw = Number(process.env.MAGIC_LINK_TTL_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : defaultTtlMinutes;
}

export function generateMagicToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type TokenCheck = "valid" | "not-found" | "expired" | "used";

export function checkMagicToken(token: MagicToken | undefined, nowMs: number): TokenCheck {
  if (!token) {
    return "not-found";
  }

  if (token.usedAt) {
    return "used";
  }

  if (new Date(token.expiresAt).getTime() <= nowMs) {
    return "expired";
  }

  return "valid";
}
