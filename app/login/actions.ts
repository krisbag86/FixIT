"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppBaseUrl } from "@/lib/base-url";
import { createMagicToken } from "@/lib/data-store";
import { isAllowedBagietkaEmail, normalizeEmail } from "@/lib/email-domain";
import { magicLinkTtlMinutes } from "@/lib/magic-link";
import { sendMagicLink } from "@/lib/notifications";
import { sessionCookieName } from "@/lib/auth";

export type LoginState =
  | { status: "error"; message: string }
  | { status: "sent"; email: string }
  | undefined;

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));

  if (!isAllowedBagietkaEmail(email)) {
    return { status: "error", message: "Podaj sluzbowy adres w dokladnej domenie bagietka.pl." };
  }

  const magicToken = await createMagicToken(email);
  const baseUrl = await getAppBaseUrl();

  await sendMagicLink({
    email,
    token: magicToken.token,
    isNewAccount: magicToken.isNewAccount,
    baseUrl,
    ttlMinutes: magicLinkTtlMinutes()
  });

  return { status: "sent", email };
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
  redirect("/login");
}
