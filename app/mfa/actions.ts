"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, sessionCookieName } from "@/lib/auth";
import { recordSecurityAudit } from "@/lib/data-store";
import { verifyTotpCode } from "@/lib/mfa";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";
import { markSessionMfaVerified } from "@/lib/session-store";

export async function verifyMfaAction(_previousState: string | undefined, formData: FormData): Promise<string | undefined> {
  const user = await getCurrentUser({ allowMfaPending: true, includeMfaSecret: true });
  if (!user || user.role !== "ADMIN" || !user.mfaEnabled || !user.mfaSecret) {
    return "Sesja MFA jest nieprawidłowa.";
  }

  const rateCheck = await checkRateLimit(`mfa:${user.id}`, RATE_LIMITS.LOGIN.windowMs, RATE_LIMITS.LOGIN.maxAttempts);
  if (!rateCheck.allowed) {
    return "Zbyt wiele prób. Spróbuj ponownie za kilka minut.";
  }

  const code = String(formData.get("code") ?? "");
  if (!verifyTotpCode(user.mfaSecret, code)) {
    await recordSecurityAudit({ action: "MFA_FAILED", entityId: user.id, summary: `${user.email}: nieprawidłowy kod MFA` });
    return "Nieprawidłowy kod MFA.";
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(sessionCookieName)?.value;
  if (!sessionId) {
    return "Sesja MFA wygasła. Zaloguj się ponownie.";
  }

  await markSessionMfaVerified(sessionId);
  await recordSecurityAudit({ action: "MFA_VERIFIED", actorId: user.id, entityId: user.id, summary: `${user.email}: potwierdzono MFA` });
  redirect(user.mustChangePassword ? "/change-password" : "/");
}
