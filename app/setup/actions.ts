"use server";

import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/password";
import { z } from "zod";
import { verifySetupToken } from "@/lib/setup-token";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";
import { headers } from "next/headers";

const setupSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8).max(200),
    confirmPassword: z.string().min(8).max(200)
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Hasła nie są zgodne.",
    path: ["confirmPassword"]
  });

async function getPrisma() {
  return (await import("@/lib/prisma")).prisma;
}

function shouldUsePrisma(): boolean {
  if (process.env.FIXIT_DATA_PROVIDER === "json") return false;
  if (process.env.FIXIT_DATA_PROVIDER === "prisma") return true;
  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
}

export async function setupPasswordAction(
  _previousState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const input = setupSchema.safeParse({ token, password, confirmPassword });
  if (!input.success) {
    return input.error.issues[0]?.message ?? "Nieprawidłowe dane.";
  }

  // Rate limit
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headersList.get("x-real-ip")
    || "unknown";
  const rateLimitKey = `setup:${ip}`;
  const rateCheck = await checkRateLimit(rateLimitKey, RATE_LIMITS.LOGIN.windowMs, RATE_LIMITS.LOGIN.maxAttempts);
  if (!rateCheck.allowed) {
    return "Zbyt wiele prób. Spróbuj ponownie za kilka minut.";
  }

  const email = verifySetupToken(input.data.token);
  if (!email) {
    return "Link jest nieprawidłowy lub wygasł. Skontaktuj się z administratorem.";
  }

  const newHash = hashPassword(input.data.password);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return "Konto nie istnieje lub jest nieaktywne.";
    }

    await db.user.update({
      where: { email },
      data: {
        passwordHash: newHash,
        mustChangePassword: false
      }
    });
  } else {
    const { readDatabase, writeDatabase } = await import("@/lib/data-store");
    const database = await readDatabase();
    const user = database.users.find((u) => u.email === email && u.isActive);
    if (!user) {
      return "Konto nie istnieje lub jest nieaktywne.";
    }
    user.passwordHash = newHash;
    (user as Record<string, unknown>).mustChangePassword = false;
    await writeDatabase(database);
  }

  redirect("/login?setup=ok");
}
