import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { AppNav } from "@/components/app-nav";
import { AutoRefresh } from "@/components/auto-refresh";
import { RoleBadge } from "@/components/badges";
import { ThemeToggle } from "@/components/theme-toggle";
import { canUseAdmin } from "@/lib/permissions";
import type { User } from "@/lib/types";

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const admin = canUseAdmin(user);

  return (
    <div className="flex min-h-screen flex-col">
      <AutoRefresh />
      <header className="sticky top-0 z-20 border-b border-black/8 bg-paper/85 shadow-sm backdrop-blur-xl dark:border-white/8 dark:bg-ink/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-mint to-river text-sm font-black text-white shadow-lg shadow-mint/20">
              IT
            </span>
            <div>
              <span className="block text-base font-black leading-tight">FixIT</span>
              <span className="block text-[11px] font-medium tracking-wide text-ink/55 dark:text-paper/55">HELPDESK</span>
            </div>
          </Link>

          <AppNav role={user.role} hasStore={Boolean(user.storeId)} admin={admin} />

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">{user.name}</div>
              <div data-testid="user-email" className="text-xs text-ink/55 dark:text-paper/55">{user.email}</div>
            </div>
            <RoleBadge role={user.role} />
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/8 bg-white/70 text-ink shadow-sm transition-all duration-200 hover:bg-white hover:shadow-md dark:border-white/8 dark:bg-white/8 dark:text-paper dark:hover:bg-white/15"
                title="Wyloguj"
                aria-label="Wyloguj"
                data-testid="logout-button"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
        <AppNav role={user.role} hasStore={Boolean(user.storeId)} admin={admin} mobile />
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>

      <footer className="border-t border-black/8 dark:border-white/8">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <p className="text-center text-xs text-ink/40 dark:text-paper/40">
            &copy; 2026 Krzysztof Graczyk. Wszelkie prawa zastrzeżone.
          </p>
        </div>
      </footer>
    </div>
  );
}
