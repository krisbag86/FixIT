export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedBagietkaEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  const parts = normalized.split("@");

  if (parts.length !== 2) {
    return false;
  }

  return parts[1] === "bagietka.pl" && parts[0].length > 0;
}
