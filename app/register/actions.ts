"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionCookieName } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/data-store";
import { isAllowedBagietkaEmail, normalizeEmail } from "@/lib/email-domain";
import { hashPassword } from "@/lib/password";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";
import { createSession } from "@/lib/session-store";

const registerSchema = z
  .object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(12).max(200),
    confirmPassword: z.string().min(8).max(200)
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Hasła nie są zgodne.",
    path: ["confirmPassword"]
  });

export async function registerAction(_previousState: string | undefined, formData: FormData): Promise<string | undefined> {
  // Check if self-registration is disabled (admin-only account creation)
  const isDisabled = process.env.DISABLE_REGISTRATION === "true" || process.env.DISABLE_REGISTRATION === "1";
  if (isDisabled) {
    return "Rejestracja jest wyłączona. Skontaktuj się z administratorem, aby utworzyć konto.";
  }

  const input = registerSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    email: normalizeEmail(String(formData.get("email") ?? "")),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? "")
  });

  if (!input.success) {
    return input.error.issues[0]?.message ?? "Nie udało się zarejestrować konta.";
  }

  if (!isAllowedBagietkaEmail(input.data.email)) {
    return "Podaj służbowy adres w domenie bagietka.pl.";
  }

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headersList.get("x-real-ip")
    || "unknown";
  const rateLimitKey = `register:${input.data.email}:${ip}`;
  const rateCheck = await checkRateLimit(rateLimitKey, RATE_LIMITS.LOGIN.windowMs, RATE_LIMITS.LOGIN.maxAttempts);

  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.resetInSeconds / 60);
    return `Zbyt wiele prób rejestracji. Spróbuj ponownie za ${minutes} min.`;
  }

  const existingUser = await findUserByEmail(input.data.email, { includeInactive: true });

  // Always return generic message to prevent email enumeration
  if (existingUser) {
    return "Jeśli konto istnieje, zostanie wysłana wiadomość z instrukcjami dalszej rejestracji.";
  }

  const user = await createUser({
    name: input.data.name,
    email: input.data.email,
    role: "REPORTER",
    isActive: true,
    passwordHash: hashPassword(input.data.password),
    mustChangePassword: false
  });

  const sessionId = await createSession(user.id);

  // Determine if the connection is secure — check x-forwarded-proto for proxy environments
  const isSecure = process.env.NODE_ENV === "production" || headersList.get("x-forwarded-proto") === "https";

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });

  redirect("/tickets/new");
}
