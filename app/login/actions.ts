"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { findUserByEmail } from "@/lib/data-store";
import { verifyPassword } from "@/lib/password";
import { isAllowedBagietkaEmail, normalizeEmail } from "@/lib/email-domain";
import { sessionCookieName } from "@/lib/auth";
import { createSession, deleteSession } from "@/lib/session-store";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";

export async function loginAction(_previousState: string | undefined, formData: FormData): Promise<string | undefined> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!isAllowedBagietkaEmail(email)) {
    return "Podaj służbowy adres w domenie bagietka.pl.";
  }

  if (!password) {
    return "Podaj hasło.";
  }

  // Rate limit: 5 attempts per 15 minutes per email
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headersList.get("x-real-ip")
    || "unknown";
  const rateLimitKey = `login:${email}:${ip}`;
  const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMITS.LOGIN.windowMs, RATE_LIMITS.LOGIN.maxAttempts);

  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.resetInSeconds / 60);
    return `Zbyt wiele prób logowania. Spróbuj ponownie za ${minutes} min.`;
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return "Nie znaleziono użytkownika o podanym adresie. Skontaktuj się z administratorem.";
  }

  if (!user.passwordHash) {
    return "Konto nie ma ustawionego hasła. Skontaktuj się z administratorem.";
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return "Nieprawidłowe hasło.";
  }

  const sessionId = await createSession(user.id);

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });

  // If user must change password (first login), redirect to change password page
  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(sessionCookieName)?.value;

  if (sessionId) {
    // Delete session from server before clearing cookie
    await deleteSession(sessionId);
  }

  cookieStore.delete(sessionCookieName);
  redirect("/login");
}
