import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";

const statusMessages: Record<string, string> = {
  expired: "Link wygasl. Wyslij nowy link do logowania.",
  used: "Ten link zostal juz uzyty. Wyslij nowy link do logowania.",
  "not-found": "Link jest nieprawidlowy. Wyslij nowy link do logowania."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  const params = await searchParams;
  const statusMessage = params.status ? statusMessages[params.status] : undefined;

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
              Logowanie linkiem email. Dostep tylko dla adresow w domenie bagietka.pl.
            </p>
          </div>
          <ThemeToggle />
        </div>
        {statusMessage ? (
          <p className="mb-4 rounded-md bg-amber-500/10 p-3 text-sm font-medium text-amber-700 dark:text-amber-200">
            {statusMessage}
          </p>
        ) : null}
        <LoginForm />
        <div className="mt-5 rounded-md bg-white/70 p-3 text-xs leading-5 text-ink/65 dark:bg-white/10 dark:text-paper/65">
          Podaj sluzbowy email @bagietka.pl. Pierwsze logowanie zakłada konto po potwierdzeniu linku z maila.
        </div>
      </section>
    </main>
  );
}
