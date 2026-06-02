import Link from "next/link";
import { BarChart3, BookOpen, Building2, ClipboardList, Columns3, Tags, Users } from "lucide-react";
import type { User } from "@/lib/types";

const links = [
  { href: "/admin/tickets", label: "Tickety", icon: ClipboardList, adminOnly: false },
  { href: "/admin/kanban", label: "Kanban", icon: Columns3, adminOnly: false },
  { href: "/admin/reports", label: "Raporty", icon: BarChart3, adminOnly: false },
  { href: "/admin/knowledge", label: "Baza wiedzy", icon: BookOpen, adminOnly: false },
  { href: "/admin/users", label: "Uzytkownicy", icon: Users, adminOnly: true },
  { href: "/admin/stores", label: "Sklepy", icon: Building2, adminOnly: true },
  { href: "/admin/categories", label: "Kategorie", icon: Tags, adminOnly: true }
] as const;

export function AdminNav({ user, currentPath }: { user: User; currentPath: string }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 rounded-md border border-black/10 bg-white/70 p-2 dark:border-white/10 dark:bg-white/10">
      {links
        .filter((link) => !link.adminOnly || user.role === "ADMIN")
        .map((link) => {
          const Icon = link.icon;
          const active = currentPath === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-bold transition ${
                active
                  ? "bg-ink text-white dark:bg-paper dark:text-ink"
                  : "text-ink/70 hover:bg-white hover:text-ink dark:text-paper/70 dark:hover:bg-white/10 dark:hover:text-paper"
              }`}
            >
              <Icon size={16} />
              {link.label}
            </Link>
          );
        })}
    </div>
  );
}
