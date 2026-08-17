import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function SettingsTile({
  href,
  label,
  description,
  icon: Icon
}: {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-black/10 bg-white/75 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-mint/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/60 dark:border-white/10 dark:bg-white/10"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint/10 text-mint transition group-hover:bg-mint group-hover:text-white dark:bg-mint/15">
          <Icon size={21} />
        </span>
        <ArrowUpRight size={18} className="text-ink/35 transition group-hover:text-mint dark:text-paper/35" />
      </div>
      <h2 className="mt-5 text-lg font-black">{label}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/60 dark:text-paper/60">{description}</p>
    </Link>
  );
}
