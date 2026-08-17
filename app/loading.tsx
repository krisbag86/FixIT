import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <div className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/60 px-5 py-2.5 text-sm font-bold text-ink/60 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-paper/60">
        <Loader2 size={18} className="animate-spin text-mint" />
        Ładowanie…
      </div>
    </div>
  );
}
