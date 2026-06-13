import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { verifySetupToken } from "@/lib/setup-token";
import { SetupPasswordForm } from "./form";

export default async function SetupPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Validate the token server-side before rendering the form
  const email = verifySetupToken(token);

  if (!email) {
    redirect("/login?setup=invalid");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4 dark:from-gray-900 dark:to-gray-950">
      <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-8 shadow-lg dark:border-white/10 dark:bg-gray-900">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mint/15">
            <ShieldCheck size={28} className="text-mint" />
          </div>
          <h1 className="text-2xl font-black">Ustaw hasło</h1>
          <p className="mt-2 text-sm text-ink/65 dark:text-paper/65">
            Konto: <strong className="text-ink dark:text-paper">{email}</strong>
          </p>
        </div>

        <SetupPasswordForm email={email} token={token} />

        <p className="mt-6 text-center text-xs text-ink/45 dark:text-paper/45">
          Link wygaśnie po 48 godzinach. Jeśli nie rejestrowałeś konta, zignoruj tę wiadomość.
        </p>
      </div>
    </div>
  );
}
