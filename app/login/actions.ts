"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserByEmail } from "@/lib/data-store";
import { verifyPassword } from "@/lib/password";
import { isAllowedBagietkaEmail, normalizeEmail } from "@/lib/email-domain";
import { sessionCookieName } from "@/lib/auth";
import { signSessionValue } from "@/lib/cookie-signature";

export async function loginAction(_previousState: string | undefined, formData: FormData): Promise<string | undefined> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!isAllowedBagietkaEmail(email)) {
    return "Podaj służbowy adres w domenie bagietka.pl.";
  }

  if (!password) {
    return "Podaj hasło.";
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

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, signSessionValue(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14
  });

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  redirect("/login");
}
