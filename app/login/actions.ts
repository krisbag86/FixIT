"use server";

import { cookies } from "next/headers";
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

  // Rate limit by account identity. Do not trust client-supplied proxy headers
  // as part of the key because they can be changed on every request.
  const rateLimitKey = `login:${email}`;
  const rateCheck = await checkRateLimit(rateLimitKey, RATE_LIMITS.LOGIN.windowMs, RATE_LIMITS.LOGIN.maxAttempts);

  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.resetInSeconds / 60);
    return `Zbyt wiele prób logowania. Spróbuj ponownie za ${minutes} min.`;
  }

  const user = await findUserByEmail(email, { includePasswordHash: true });

  if (!user) {
    // Use the same generic message for both missing user and wrong password
    // to prevent username/email enumeration
    return "Nieprawidłowy adres e-mail lub hasło. Spróbuj ponownie.";
  }

  if (!user.passwordHash) {
    return "Nieprawidłowy adres e-mail lub hasło. Spróbuj ponownie.";
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return "Nieprawidłowy adres e-mail lub hasło. Spróbuj ponownie.";
  }

  const sessionId = await createSession(user.id);

  // Production deployments terminate HTTPS before reaching the app.
  const isSecure = process.env.NODE_ENV === "production";

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
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
