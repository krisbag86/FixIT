import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { ChangePasswordForm } from "./form";
import { getCurrentUser } from "@/lib/auth";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // If user doesn't need to change password, redirect to dashboard
  if (!user.mustChangePassword) {
    redirect("/tickets");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      {/* Tło */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-96 w-96 animate-pulse rounded-full bg-mint/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 animate-pulse rounded-full bg-river/10 blur-3xl" style={{ animationDelay: "2s" }} />
      </div>

      <section className="relative w-full max-w-md">
        <div className="absolute -inset-0.5 animate-pulse rounded-2xl bg-gradient-to-r from-mint via-river to-amberline opacity-20 blur" />

        <div className="relative rounded-2xl border border-white/20 bg-paper/95 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-ink/95">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amberline to-orange-500 text-white shadow-lg shadow-amberline/20">
              <LockKeyhole size={28} />
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              Zmiana hasła
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink/60 dark:text-paper/60">
              Witaj, <strong>{user.name}</strong>! To Twoje pierwsze logowanie.{" "}
              Ustaw nowe hasło, aby kontynuować.
            </p>
          </div>

          <ChangePasswordForm />
        </div>
      </section>
    </main>
  );
}
