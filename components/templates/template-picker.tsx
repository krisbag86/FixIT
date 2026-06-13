"use client";

import { ChevronDown } from "lucide-react";
import { resolveTemplateVariables } from "@/lib/format";
import type { ResponseMacro, ResponseTemplate, Ticket } from "@/lib/types";

export function TemplatePicker({
  templates,
  macros,
  ticket,
  user,
  assignee,
  category,
  onInsert
}: {
  templates: ResponseTemplate[];
  macros: ResponseMacro[];
  ticket: Ticket;
  user: { id: string; name: string; email: string };
  assignee?: { id: string; name: string };
  category?: { id: string; name: string };
  onInsert: (body: string) => void;
}) {
  const activeTemplates = templates.filter((t) => t.isActive);
  const activeMacros = macros.filter((m) => m.isActive);

  if (activeTemplates.length === 0 && activeMacros.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 flex flex-col gap-2">
      {activeMacros.length > 0 && (
        <div>
          <span className="text-xs font-bold uppercase text-ink/50 dark:text-paper/50">Makra:</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {activeMacros.map((macro) => {
              const template = activeTemplates.find((t) => t.id === macro.templateId);
              const body = template
                ? resolveTemplateVariables(template.body, {
                    ticket: { title: ticket.title, number: ticket.number, description: ticket.description },
                    user: { name: user.name, email: user.email },
                    assignee: assignee ? { name: assignee.name } : undefined,
                    category: category ? { name: category.name } : undefined
                  })
                : macro.body ?? "";

              return (
                <button
                  key={macro.id}
                  type="button"
                  onClick={() => onInsert(body)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-mint/30 bg-mint/10 px-3 text-xs font-bold text-mint hover:bg-mint/20"
                  title={`Użyj makra: ${macro.name}${macro.newStatus ? ` (status: ${macro.newStatus})` : ""}`}
                >
                  {macro.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {activeTemplates.length > 0 && (
        <div className="relative">
          <select
            className="h-8 min-w-40 rounded-md border border-black/10 bg-white px-2 text-xs outline-none dark:border-white/10 dark:bg-white/10"
            onChange={(e) => {
              const template = activeTemplates.find((t) => t.id === e.target.value);
              if (template) {
                const body = resolveTemplateVariables(template.body, {
                  ticket: { title: ticket.title, number: ticket.number, description: ticket.description },
                  user: { name: user.name, email: user.email },
                  assignee: assignee ? { name: assignee.name } : undefined,
                  category: category ? { name: category.name } : undefined
                });
                onInsert(body);
                e.target.selectedIndex = 0;
              }
            }}
            defaultValue=""
          >
            <option value="">— Wybierz szablon —</option>
            {activeTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink/40 dark:text-paper/40" />
        </div>
      )}
    </div>
  );
}