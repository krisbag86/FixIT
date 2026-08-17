import { Archive, BarChart3, BookOpen, CalendarClock, CalendarDays, ClipboardList, Columns3, LayoutDashboard, Settings, Tags, Users, Building2, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { User } from "@/lib/types";

export type AdminNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  featured?: boolean;
};

export type AdminNavGroup = {
  label: string;
  links: AdminNavLink[];
};

const settingsPaths = [
  "/admin/settings",
  "/admin/reports",
  "/admin/users",
  "/admin/stores",
  "/admin/categories",
  "/admin/templates"
] as const;

export function isSettingsPath(pathname: string): boolean {
  return settingsPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function getAdminNavGroups(_user: Pick<User, "role">): AdminNavGroup[] {
  return [
    {
      label: "Narzędzia operacyjne",
      links: [
        { href: "/admin/daylog", label: "DayLog", icon: CalendarClock, featured: true },
        { href: "/admin/schedule", label: "Grafik", icon: CalendarDays, featured: true }
      ]
    },
    {
      label: "Panel IT",
      links: [
        { href: "/admin/dashboard", label: "Pulpit", icon: LayoutDashboard },
        { href: "/admin/tickets", label: "Zgłoszenia", icon: ClipboardList },
        { href: "/admin/kanban", label: "Kanban", icon: Columns3 },
        { href: "/admin/knowledge", label: "Baza wiedzy", icon: BookOpen },
        { href: "/tickets/archive", label: "Archiwum", icon: Archive }
      ]
    },
    {
      label: "Ustawienia",
      links: [{ href: "/admin/settings", label: "Ustawienia", icon: Settings }]
    }
  ];
}

export const settingsTiles = [
  { href: "/admin/reports", label: "Raporty", description: "Metryki, SLA i eksport danych.", icon: BarChart3, adminOnly: false },
  { href: "/admin/users", label: "Użytkownicy", description: "Konta, role, zaproszenia i dostęp do grafiku.", icon: Users, adminOnly: true },
  { href: "/admin/stores", label: "Sklepy", description: "Sklepy, lokalizacje i przypisania zespołów.", icon: Building2, adminOnly: true },
  { href: "/admin/categories", label: "Kategorie", description: "Kategorie zgłoszeń i domyślne priorytety.", icon: Tags, adminOnly: true },
  { href: "/admin/templates", label: "Szablony", description: "Szablony odpowiedzi i makra dla zespołu IT.", icon: FileText, adminOnly: true }
] as const;
