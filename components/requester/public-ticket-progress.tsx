import { Check } from "lucide-react";
import { getPublicTicketStage, publicTicketStageLabels, publicTicketStages } from "@/lib/requester-portal";
import type { TicketStatus } from "@/lib/types";

export function PublicTicketProgress({ status, compact = false }: { status: TicketStatus; compact?: boolean }) {
  const currentStage = getPublicTicketStage(status);
  const currentIndex = publicTicketStages.indexOf(currentStage);

  if (compact) {
    return (
      <span data-testid="public-ticket-progress" className="inline-flex w-fit items-center rounded-full bg-mint/10 px-3 py-1 text-sm font-bold text-mint dark:bg-mint/15">
        {publicTicketStageLabels[currentStage]}
      </span>
    );
  }

  return (
    <div data-testid="public-ticket-progress" aria-label={`Postęp zgłoszenia: ${publicTicketStageLabels[currentStage]}`}>
      <ol className="grid gap-2 sm:grid-cols-6">
        {publicTicketStages.map((stage, index) => {
          const complete = index <= currentIndex;
          const current = index === currentIndex;

          return (
            <li key={stage} aria-current={current ? "step" : undefined} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold sm:block sm:text-center ${current ? "bg-mint/10 text-mint" : "text-ink/45 dark:text-paper/45"}`}>
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${complete ? "border-mint bg-mint text-white" : "border-black/15 dark:border-white/15"}`}>
                {complete && index < currentIndex ? <Check size={14} /> : index + 1}
              </span>
              <span className="sm:mt-2 sm:block">{publicTicketStageLabels[stage]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
