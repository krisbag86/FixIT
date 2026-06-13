"use server";

import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/password";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";

async function getPrisma() {
  return (await import("@/lib/prisma")).prisma;
}

function shouldUsePrisma(): boolean {
  if (process.env.FIXIT_DATA_PROVIDER === "json") return false;
  if (process.env.FIXIT_DATA_PROVIDER === "prisma") return true;
  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
}

export async function changePasswordAction(_previousState: string | undefined, formData: FormData): Promise<string | undefined> {
  const user = await getCurrentUser();

  if (!user) {
    return "Musisz być zalogowany, aby zmienić hasło.";
  }

  // Rate limit: 5 attempts per 15 minutes per user
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headersList.get("x-real-ip")
    || "unknown";
  const rateLimitKey = `change-password:${user.id}:${ip}`;
  const rateCheck = await checkRateLimit(rateLimitKey, RATE_LIMITS.LOGIN.windowMs, RATE_LIMITS.LOGIN.maxAttempts);

  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.resetInSeconds / 60);
    return `Zbyt wiele prób zmiany hasła. Spróbuj ponownie za ${minutes} min.`;
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) {
    return "Podaj obecne hasło.";
  }

  if (!newPassword) {
    return "Podaj nowe hasło.";
  }

  if (newPassword.length < 12) {
    return "Nowe hasło musi mieć co najmniej 12 znaków.";
  }

  // Check for at least one uppercase, lowercase, digit, and special character
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasDigit = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword);

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return "Hasło musi zawierać małe i wielkie litery, cyfrę oraz znak specjalny.";
  }

  if (newPassword !== confirmPassword) {
    return "Nowe hasła nie są zgodne.";
  }

  // Verify current password
  if (!user.passwordHash || !verifyPassword(currentPassword, user.passwordHash)) {
    return "Obecne hasło jest nieprawidłowe.";
  }

  // Hash new password
  const newHash = hashPassword(newPassword);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false
      }
    });
  } else {
    const { readDatabase, writeDatabase } = await import("@/lib/data-store");
    const database = await readDatabase();
    const dbUser = database.users.find((u) => u.id === user.id);
    if (dbUser) {
      dbUser.passwordHash = newHash;
      (dbUser as Record<string, unknown>).mustChangePassword = false;
      await writeDatabase(database);
    }
  }

  redirect("/tickets");
}
