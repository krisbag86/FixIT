import Link from "next/link";
import { BookOpen, ClipboardList, LayoutDashboard, LogOut, Plus, ShieldCheck, Store } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { RoleBadge } from "@/components/badges";
import { ThemeToggle } from "@/components/theme-toggle";
import { canUseAdmin } from "@/lib/permissions";
import type { User } from "@/lib/types";

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const admin = canUseAdmin(user);

  return (
    <div className="min-h-screen">
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

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink href="/tickets" icon={<ClipboardList size={17} />}>
              Moje zgłoszenia
            </NavLink>
            <NavLink href="/tickets/new" icon={<Plus size={17} />}>
              Nowe
            </NavLink>
            <NavLink href="/knowledge" icon={<BookOpen size={17} />}>
              Baza wiedzy
            </NavLink>
            {user.role === "STORE_MANAGER" && user.storeId ? (
              <NavLink href="/store" icon={<Store size={17} />}>
                Mój sklep
              </NavLink>
            ) : null}
            {admin ? (
              <NavLink href="/admin/tickets" icon={<LayoutDashboard size={17} />}>
                Panel IT
              </NavLink>
            ) : null}
          </nav>

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
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          <NavLink href="/tickets" icon={<ClipboardList size={17} />}>
            Moje
          </NavLink>
          <NavLink href="/tickets/new" icon={<Plus size={17} />}>
            Nowe
          </NavLink>
          <NavLink href="/knowledge" icon={<BookOpen size={17} />}>
            Wiedza
          </NavLink>
          {user.role === "STORE_MANAGER" && user.storeId ? (
            <NavLink href="/store" icon={<Store size={17} />}>
              Sklep
            </NavLink>
          ) : null}
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
      className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink/65 transition-all duration-200 hover:bg-white/80 hover:text-ink dark:text-paper/65 dark:hover:bg-white/10 dark:hover:text-paper"
    >
      {icon}
      {children}
    </Link>
  );
}
