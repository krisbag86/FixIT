import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { RegisterForm } from "@/components/register-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-96 w-96 animate-pulse rounded-full bg-mint/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 animate-pulse rounded-full bg-river/10 blur-3xl" style={{ animationDelay: "2s" }} />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 animate-pulse rounded-full bg-amberline/8 blur-3xl" style={{ animationDelay: "4s" }} />
      </div>

      <section className="relative w-full max-w-xl">
        <div className="absolute -inset-0.5 animate-pulse rounded-2xl bg-gradient-to-r from-mint via-river to-amberline opacity-20 blur" />

        <div className="relative rounded-2xl border border-white/20 bg-paper/95 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-ink/95">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-mint to-river text-white shadow-lg shadow-mint/20">
                <UserPlus size={28} />
              </div>
              <h1 className="bg-gradient-to-r from-mint to-river bg-clip-text text-3xl font-black tracking-tight text-transparent">
                Rejestracja FixIT
              </h1>
              <p className="mt-1 text-sm leading-6 text-ink/60 dark:text-paper/60">
                Załóż konto służbowe i zgłaszaj awarie w systemie Bagietka.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <RegisterForm />
        </div>
      </section>
    </main>
  );
}
