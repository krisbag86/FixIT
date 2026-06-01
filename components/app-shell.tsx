import Link from "next/link";
import { ClipboardList, LayoutDashboard, LogOut, Plus, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { RoleBadge } from "@/components/badges";
import { ThemeToggle } from "@/components/theme-toggle";
import { canUseAdmin } from "@/lib/permissions";
import type { User } from "@/lib/types";

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const admin = canUseAdmin(user);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-paper/90 backdrop-blur dark:border-white/10 dark:bg-ink/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-sm font-black text-white shadow-soft">
              IT
            </span>
            <span>
              <span className="block text-base font-black leading-tight">FixIT</span>
              <span className="block text-xs text-ink/60 dark:text-paper/60">Bagietka helpdesk</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink href="/tickets" icon={<ClipboardList size={17} />}>
              Moje zgloszenia
            </NavLink>
            <NavLink href="/tickets/new" icon={<Plus size={17} />}>
              Nowe
            </NavLink>
            {admin ? (
              <NavLink href="/admin/tickets" icon={<LayoutDashboard size={17} />}>
                Panel IT
              </NavLink>
            ) : null}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold">{user.name}</div>
              <div data-testid="user-email" className="text-xs text-ink/60 dark:text-paper/60">{user.email}</div>
            </div>
            <RoleBadge role={user.role} />
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-black/10 bg-white/70 text-ink shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-paper dark:hover:bg-white/15"
                title="Wyloguj"
                aria-label="Wyloguj"
                data-testid="logout-button"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pb-3 md:hidden">
          <NavLink href="/tickets" icon={<ClipboardList size={17} />}>
            Moje
          </NavLink>
          <NavLink href="/tickets/new" icon={<Plus size={17} />}>
            Nowe
          </NavLink>
          {admin ? (
            <NavLink href="/admin/tickets" icon={<ShieldCheck size={17} />}>
              IT
            </NavLink>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-ink/70 transition hover:bg-white/70 hover:text-ink dark:text-paper/70 dark:hover:bg-white/10 dark:hover:text-paper"
    >
      {icon}
      {children}
    </Link>
  );
}
