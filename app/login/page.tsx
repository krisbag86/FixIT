import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-black/10 bg-paper/90 p-6 shadow-soft backdrop-blur dark:border-white/10 dark:bg-ink/90">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-mint text-white">
              <ShieldCheck size={24} />
            </div>
            <h1 className="text-2xl font-black">FixIT Helpdesk</h1>
            <p className="mt-2 text-sm leading-6 text-ink/65 dark:text-paper/65">
              Logowanie tylko dla adresow w domenie bagietka.pl.
            </p>
          </div>
          <ThemeToggle />
        </div>
        <LoginForm />
        <div className="mt-5 rounded-md bg-white/70 p-3 text-xs leading-5 text-ink/65 dark:bg-white/10 dark:text-paper/65">
          Konta testowe: admin@bagietka.pl, agent@bagietka.pl, sklep.waw01@bagietka.pl, kasjer@bagietka.pl.
        </div>
      </section>
    </main>
  );
}
