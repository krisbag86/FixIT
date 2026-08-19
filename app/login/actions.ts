"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserByEmail, recordSecurityAudit } from "@/lib/data-store";
import { verifyPassword } from "@/lib/password";
import { isAllowedBagietkaEmail, normalizeEmail } from "@/lib/email-domain";
import { getCurrentUser, sessionCookieName } from "@/lib/auth";
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
  const isIsolatedE2e = process.env.NODE_ENV !== "production" && process.env.FIXIT_E2E === "true";
  if (!isIsolatedE2e) {
    const rateLimitKey = `login:${email}`;
    const rateCheck = await checkRateLimit(rateLimitKey, RATE_LIMITS.LOGIN.windowMs, RATE_LIMITS.LOGIN.maxAttempts);

    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.resetInSeconds / 60);
      return `Zbyt wiele prób logowania. Spróbuj ponownie za ${minutes} min.`;
    }
  }

  const user = await findUserByEmail(email, { includePasswordHash: true, includeMfaSecret: true });

  if (!user) {
    // Use the same generic message for both missing user and wrong password
    // to prevent username/email enumeration
    await recordSecurityAudit({ action: "LOGIN_FAILED", entityId: email, summary: `Nieudane logowanie: ${email}` });
    return "Nieprawidłowy adres e-mail lub hasło. Spróbuj ponownie.";
  }

  if (!user.passwordHash) {
    await recordSecurityAudit({ action: "LOGIN_FAILED", entityId: user.id, summary: `Nieudane logowanie bez ustawionego hasła: ${user.email}` });
    return "Nieprawidłowy adres e-mail lub hasło. Spróbuj ponownie.";
  }

  if (!verifyPassword(password, user.passwordHash)) {
    await recordSecurityAudit({ action: "LOGIN_FAILED", entityId: user.id, summary: `Nieudane logowanie: ${user.email}` });
    return "Nieprawidłowy adres e-mail lub hasło. Spróbuj ponownie.";
  }

  const requiresMfa = user.role === "ADMIN" && user.mfaEnabled === true && Boolean(user.mfaSecret);
  const sessionId = await createSession(user.id, !requiresMfa);

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

  if (requiresMfa) {
    await recordSecurityAudit({ action: "LOGIN_PASSWORD_VERIFIED", actorId: user.id, entityId: user.id, summary: `${user.email}: oczekiwanie na kod MFA` });
    redirect("/mfa");
  }

  // If user must change password (first login), redirect to change password page
  if (user.mustChangePassword) {
    await recordSecurityAudit({ action: "LOGIN_SUCCEEDED", actorId: user.id, entityId: user.id, summary: `${user.email}: logowanie wymaga zmiany hasła` });
    redirect("/change-password");
  }

  await recordSecurityAudit({ action: "LOGIN_SUCCEEDED", actorId: user.id, entityId: user.id, summary: `${user.email}: zalogowano` });
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(sessionCookieName)?.value;
  const user = await getCurrentUser();

  if (sessionId) {
    // Delete session from server before clearing cookie
    await deleteSession(sessionId);
  }

  cookieStore.delete(sessionCookieName);
  if (user) {
    await recordSecurityAudit({ action: "LOGOUT", actorId: user.id, entityId: user.id, summary: `${user.email}: wylogowano` });
  }
  redirect("/login");
}
