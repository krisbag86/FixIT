"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sessionCookieName, getCurrentUser } from "@/lib/auth";

async function getPrisma() {
  return (await import("@/lib/prisma")).prisma;
}

function shouldUsePrisma(): boolean {
  if (process.env.FIXIT_DATA_PROVIDER === "json") return false;
  if (process.env.FIXIT_DATA_PROVIDER === "prisma") return true;
  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL);
}

export async function changePasswordAction(_previousState: string | undefined, formData: FormData): Promise<string | undefined> {
  const user = await getCurrentUser();

  if (!user) {
    return "Musisz być zalogowany, aby zmienić hasło.";
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) {
    return "Podaj obecne hasło.";
  }

  if (!newPassword) {
    return "Podaj nowe hasło.";
  }

  if (newPassword.length < 6) {
    return "Nowe hasło musi mieć co najmniej 6 znaków.";
  }

  if (newPassword !== confirmPassword) {
    return "Nowe hasła nie są zgodne.";
  }

  // Verify current password
  if (!user.passwordHash || !verifyPassword(currentPassword, user.passwordHash)) {
    return "Obecne hasło jest nieprawidłowe.";
  }

  // Hash new password
  const newHash = hashPassword(newPassword);

  if (shouldUsePrisma()) {
    const db = await getPrisma();
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false
      }
    });
  } else {
    const { readDatabase, writeDatabase } = await import("@/lib/data-store");
    const database = await readDatabase();
    const dbUser = database.users.find((u) => u.id === user.id);
    if (dbUser) {
      dbUser.passwordHash = newHash;
      (dbUser as Record<string, unknown>).mustChangePassword = false;
      await writeDatabase(database);
    }
  }

  redirect("/tickets");
}
