import { cn } from "@/lib/cn";
import { Inbox, SearchX, FileText, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

type EmptyStateVariant = "tickets" | "search" | "articles" | "success" | "default";

const variantConfig: Record<
  EmptyStateVariant,
  { icon: React.ReactNode; defaultTitle: string; iconColor: string }
> = {
  tickets: {
    icon: <Inbox size={40} />,
    defaultTitle: "Brak zgłoszeń",
    iconColor: "text-ink/25 dark:text-paper/25",
  },
  search: {
    icon: <SearchX size={40} />,
    defaultTitle: "Brak wyników",
    iconColor: "text-ink/25 dark:text-paper/25",
  },
  articles: {
    icon: <FileText size={40} />,
    defaultTitle: "Brak artykułów",
    iconColor: "text-ink/25 dark:text-paper/25",
  },
  success: {
    icon: <CheckCircle size={40} />,
    defaultTitle: "Gotowe",
    iconColor: "text-emerald-400",
  },
  default: {
    icon: <AlertCircle size={40} />,
    defaultTitle: "Nic tutaj nie ma",
    iconColor: "text-ink/25 dark:text-paper/25",
  },
};

export function EmptyState({
  variant = "default",
  title,
  description,
  actionHref,
  actionLabel,
  className,
}: {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  className?: string;
}) {
  const config = variantConfig[variant];

  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-black/20 bg-white/60 p-12 text-center dark:border-white/20 dark:bg-white/10",
        className
      )}
    >
      <div className={cn("mb-4 flex justify-center", config.iconColor)}>
        {config.icon}
      </div>
      <h2 className="text-xl font-black">{title ?? config.defaultTitle}</h2>
      {description ? (
        <p className="mt-2 text-ink/65 dark:text-paper/65">{description}</p>
      ) : null}
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-mint px-5 text-sm font-bold text-white transition hover:bg-mint/90"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
