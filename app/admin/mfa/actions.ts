"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { updateUserMfa } from "@/lib/data-store";
import { getMfaOtpAuthUrl, generateMfaSecret, verifyTotpCode } from "@/lib/mfa";

export type MfaSetupState = {
  status: "idle" | "success" | "error";
  message?: string;
  secret?: string;
  otpauthUrl?: string;
  enabled?: boolean;
};

export async function mfaSetupAction(
  _previousState: MfaSetupState,
  formData: FormData
): Promise<MfaSetupState> {
  const user = await getCurrentUser({ includeMfaSecret: true });

  if (!user || user.role !== "ADMIN") {
    return { status: "error", message: "Brak uprawnień administracyjnych." };
  }

  const intent = String(formData.get("intent") ?? "start");

  if (intent === "start") {
    const secret = user.mfaSecret ?? generateMfaSecret();
    await updateUserMfa({
      userId: user.id,
      enabled: false,
      secret,
      actorId: user.id,
      auditAction: "MFA_SECRET_PROVISIONED"
    });

    return {
      status: "success",
      message: "Zeskanuj kod QR lub wpisz sekret w aplikacji uwierzytelniającej, a następnie potwierdź kod.",
      secret,
      otpauthUrl: getMfaOtpAuthUrl(user.email, secret),
      enabled: false
    };
  }

  const code = String(formData.get("code") ?? "");
  if (!user.mfaSecret || !verifyTotpCode(user.mfaSecret, code)) {
    return { status: "error", message: "Nieprawidłowy kod MFA." };
  }

  if (intent === "disable") {
    await updateUserMfa({ userId: user.id, enabled: false, secret: null, actorId: user.id });
    revalidatePath("/admin/users");
    return { status: "success", message: "MFA zostało wyłączone.", enabled: false };
  }

  await updateUserMfa({ userId: user.id, enabled: true, secret: user.mfaSecret, actorId: user.id });
  revalidatePath("/admin/users");
  return { status: "success", message: "MFA zostało włączone dla tego konta.", enabled: true };
}
