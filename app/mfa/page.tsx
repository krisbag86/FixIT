import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { MfaForm } from "./form";

export default async function MfaPage() {
  const user = await getCurrentUser({ allowMfaPending: true });

  if (!user || user.role !== "ADMIN" || !user.mfaEnabled) {
    redirect("/login");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-white/20 bg-paper/95 p-8 shadow-2xl dark:border-white/10 dark:bg-ink/95">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-mint to-river text-white">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-black">Potwierdź logowanie</h1>
          <p className="mt-2 text-sm text-ink/60 dark:text-paper/60">Wpisz sześciocyfrowy kod z aplikacji uwierzytelniającej.</p>
        </div>
        <MfaForm />
      </section>
    </main>
  );
}
