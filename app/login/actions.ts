"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createOrFindUser } from "@/lib/data-store";
import { isAllowedBagietkaEmail, normalizeEmail } from "@/lib/email-domain";
import { sessionCookieName } from "@/lib/auth";

export async function loginAction(_previousState: string | undefined, formData: FormData): Promise<string | undefined> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!isAllowedBagietkaEmail(email)) {
    return "Podaj sluzbowy adres w dokladnej domenie bagietka.pl.";
  }

  const user = await createOrFindUser(email);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, user.id, {
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
