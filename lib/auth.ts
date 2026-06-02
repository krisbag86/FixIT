import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@/lib/types";

export const sessionCookieName = "fixit_session";

export async function getCurrentUser(): Promise<User | undefined> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(sessionCookieName)?.value;

  if (!sessionId) {
    return undefined;
  }

  const { getSessionUser } = await import("@/lib/session-store");
  return getSessionUser(sessionId);
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
