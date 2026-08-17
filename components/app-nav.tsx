"use client";

import { usePathname } from "next/navigation";
import { Archive, BookOpen, ClipboardList, LayoutDashboard, Plus } from "lucide-react";
import Link from "next/link";

const navItems = [
  { href: "/tickets", label: "Moje zgłoszenia", compactLabel: "Moje", icon: ClipboardList },
  { href: "/tickets/archive", label: "Archiwum", compactLabel: "Archiwum", icon: Archive },
  { href: "/tickets/new", label: "Nowe", compactLabel: "Nowe", icon: Plus },
  { href: "/knowledge", label: "Baza wiedzy", compactLabel: "Wiedza", icon: BookOpen }
] as const;

export function AppNav({ admin, mobile = false }: { admin: boolean; mobile?: boolean }) {
  const pathname = usePathname();
  const items = [
    ...navItems,
    ...(admin ? [{ href: "/admin/tickets", label: "Panel IT", compactLabel: "IT", icon: LayoutDashboard }] : [])
  ];

  return (
    <nav
      className={mobile ? "mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 md:hidden" : "hidden items-center gap-1 md:flex"}
      aria-label="Główna nawigacja"
    >
      {items.map((item) => (
        <NavLink key={item.href} href={item.href} pathname={pathname} icon={<item.icon size={17} />}>
          {mobile ? item.compactLabel : item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function NavLink({ href, pathname, icon, children }: { href: string; pathname: string; icon: React.ReactNode; children: React.ReactNode }) {
  const active = isActive(href, pathname);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 ${
        active
          ? "bg-mint/10 text-mint dark:bg-mint/15 dark:text-mint"
          : "text-ink/65 hover:bg-white/80 hover:text-ink dark:text-paper/65 dark:hover:bg-white/10 dark:hover:text-paper"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function isActive(href: string, pathname: string) {
  if (href === "/tickets") {
    return pathname === "/tickets" || (pathname.startsWith("/tickets/") && !["/tickets/archive", "/tickets/new"].some((path) => pathname.startsWith(path)));
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
