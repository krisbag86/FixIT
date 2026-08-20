import Link from "next/link";
import { getAdminNavGroups, isSettingsPath } from "@/lib/admin-navigation";
import type { User } from "@/lib/types";

export function AdminNav({ user, currentPath }: { user: User; currentPath: string }) {
  return (
    <nav
      aria-label="Nawigacja panelu IT"
      className="mb-6 flex flex-nowrap gap-2 overflow-x-auto rounded-md border border-black/10 bg-white/70 p-2 [contain:paint] scrollbar-none dark:border-white/10 dark:bg-white/10 lg:flex-wrap lg:overflow-visible"
    >
      {getAdminNavGroups(user).map((group, groupIndex) => (
        <div
          key={group.label}
          aria-label={group.label}
          data-nav-group={group.label}
          className={`flex shrink-0 items-center gap-1 ${groupIndex > 0 ? "border-l border-black/10 pl-2 dark:border-white/10" : ""}`}
        >
          <span className="sr-only">{group.label}</span>
          {group.links.map((link) => {
            const Icon = link.icon;
            const active = link.href === "/admin/settings"
              ? isSettingsPath(currentPath)
              : currentPath === link.href || currentPath.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 ${
                  active
                    ? link.featured
                      ? "bg-mint text-white shadow-sm shadow-mint/20"
                      : "bg-ink text-white dark:bg-paper dark:text-ink"
                    : link.featured
                      ? "bg-mint/10 text-mint hover:bg-mint/20 dark:bg-mint/15 dark:hover:bg-mint/25"
                      : "text-ink/70 hover:bg-white hover:text-ink dark:text-paper/70 dark:hover:bg-white/10 dark:hover:text-paper"
                }`}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
