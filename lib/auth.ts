import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById } from "@/lib/data-store";
import type { User } from "@/lib/types";

export const sessionCookieName = "fixit_session";

export async function getCurrentUser(): Promise<User | undefined> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(sessionCookieName)?.value;

  if (!userId) {
    return undefined;
  }

  return findUserById(userId);
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
