import { redirect } from "next/navigation";
import { Plus, FileText, Trash2 } from "lucide-react";
import {
  createMacroAdminAction,
  createTemplateAdminAction,
  deleteMacroAdminAction,
  deleteTemplateAdminAction,
  updateMacroAdminAction,
  updateTemplateAdminAction
} from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AppShell } from "@/components/app-shell";
import { priorityLabels, ticketPriorities, statusLabels, ticketStatuses } from "@/lib/labels";
import { requireUser } from "@/lib/auth";
import { listMacros, listTemplates } from "@/lib/data-store";
import { can } from "@/lib/permissions";
import type { TicketPriority, TicketStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const user = await requireUser();

  if (!can(user, "admin:manage-templates")) {
    redirect("/admin/tickets");
  }

  const [templates, macros] = await Promise.all([
    listTemplates(),
    listMacros()
  ]);

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-mint">
          <FileText size={20} />
          <span className="text-sm font-black uppercase">Administracja</span>
        </div>
        <h1 className="text-3xl font-black">Szablony odpowiedzi</h1>
        <p className="mt-2 text-ink/65 dark:text-paper/65">
          Zarządzaj szablonami i makrami dla szybkich odpowiedzi.
        </p>
      </div>

      <AdminNav user={user} currentPath="/admin/templates" />

      {/* Templates Section */}
      <section className="mb-6 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
        <div className="mb-4 flex items-center gap-2">
          <Plus size={18} className="text-mint" />
          <h2 className="text-lg font-black">Dodaj szablon</h2>
        </div>
        <form action={createTemplateAdminAction} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <input name="name" placeholder="Nazwa szablonu" className={fieldClass} required />
          <input name="category" placeholder="Kategoria (opcjonalnie)" className={fieldClass} />
          <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
            Aktywny
          </label>
          <button className="h-10 rounded-md bg-mint px-4 text-sm font-bold text-white transition hover:bg-mint/90" type="submit">
            Dodaj
          </button>
          <textarea
            name="body"
            placeholder="Treść szablonu (użyj {{ticket.title}}, {{user.name}}, {{assignee.name}})"
            className="col-span-full min-h-24 resize-y rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
            required
          />
        </form>
      </section>

      {templates.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/70 text-left dark:bg-white/10">
                <th className="px-4 py-3 font-bold">Nazwa</th>
                <th className="px-4 py-3 font-bold">Kategoria</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Edycja</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr
                  key={template.id}
                  className="border-t border-black/5 bg-white/80 align-top dark:border-white/5 dark:bg-white/5"
                >
                  <td className="px-4 py-3 font-semibold">{template.name}</td>
                  <td className="px-4 py-3 text-ink/65 dark:text-paper/65">{template.category ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        template.isActive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-ink/55 dark:text-paper/55"
                      }
                    >
                      {template.isActive ? "Aktywny" : "Nieaktywny"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <form action={updateTemplateAdminAction} className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                        <input type="hidden" name="id" value={template.id} />
                        <input name="name" defaultValue={template.name} className={fieldClass} required />
                        <input
                          name="category"
                          defaultValue={template.category ?? ""}
                          className={fieldClass}
                          placeholder="Kategoria"
                        />
                        <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
                          <input type="checkbox" name="isActive" defaultChecked={template.isActive} className="h-4 w-4" />
                          Aktywny
                        </label>
                        <button className="h-10 rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
                          Zapisz
                        </button>
                        <textarea
                          name="body"
                          defaultValue={template.body}
                          className="col-span-full min-h-24 resize-y rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
                          required
                        />
                      </form>
                      <form action={deleteTemplateAdminAction}>
                        <input type="hidden" name="id" value={template.id} />
                        <button
                          type="submit"
                          className="inline-flex h-10 items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 text-sm font-bold text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={16} />
                          Usuń
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-ink/55 dark:text-paper/55">Brak szablonów odpowiedzi.</p>
      )}

      {/* Macros Section */}
      <section className="mt-8 rounded-md border border-black/10 bg-white/75 p-4 dark:border-white/10 dark:bg-white/10">
        <div className="mb-4 flex items-center gap-2">
          <Plus size={18} className="text-mint" />
          <h2 className="text-lg font-black">Dodaj makro</h2>
        </div>
        <form action={createMacroAdminAction} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <input name="name" placeholder="Nazwa makra" className={fieldClass} required />
          <select name="templateId" defaultValue="" className={fieldClass}>
            <option value="">— brak szablonu —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select name="newStatus" defaultValue="" className={fieldClass}>
            <option value="">— brak zmian —</option>
            {ticketStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          <select name="newPriority" defaultValue="" className={fieldClass}>
            <option value="">— brak zmian —</option>
            {ticketPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabels[priority as TicketPriority]}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
            <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
            Aktywne
          </label>
          <button className="h-10 rounded-md bg-mint px-4 text-sm font-bold text-white transition hover:bg-mint/90" type="submit">
            Dodaj
          </button>
          <textarea
            name="body"
            placeholder="Treść (jeśli nie wybrano szablonu)"
            className="col-span-full min-h-20 resize-y rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
          />
        </form>
      </section>

      {macros.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-md border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/70 text-left dark:bg-white/10">
                <th className="px-4 py-3 font-bold">Nazwa</th>
                <th className="px-4 py-3 font-bold">Szablon</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Priorytet</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Edycja</th>
              </tr>
            </thead>
            <tbody>
              {macros.map((macro) => {
                const template = templates.find((t) => t.id === macro.templateId);
                return (
                  <tr
                    key={macro.id}
                    className="border-t border-black/5 bg-white/80 align-top dark:border-white/5 dark:bg-white/5"
                  >
                    <td className="px-4 py-3 font-semibold">{macro.name}</td>
                    <td className="px-4 py-3 text-ink/65 dark:text-paper/65">{template?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink/65 dark:text-paper/65">
                      {macro.newStatus ? statusLabels[macro.newStatus as TicketStatus] : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink/65 dark:text-paper/65">
                      {macro.newPriority ? priorityLabels[macro.newPriority as TicketPriority] : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          macro.isActive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-ink/55 dark:text-paper/55"
                        }
                      >
                        {macro.isActive ? "Aktywne" : "Nieaktywne"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <form action={updateMacroAdminAction} className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                          <input type="hidden" name="id" value={macro.id} />
                          <input name="name" defaultValue={macro.name} className={fieldClass} required />
                          <select name="templateId" defaultValue={macro.templateId ?? ""} className={fieldClass}>
                            <option value="">— brak szablonu —</option>
                            {templates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
<select name="newStatus" defaultValue={macro.newStatus ?? ""} className={fieldClass}>
                            <option value="">— brak zmian —</option>
                            {ticketStatuses.map((status) => (
                              <option key={status} value={status}>
                                {statusLabels[status]}
                              </option>
                            ))}
                          </select>
                          <select name="newPriority" defaultValue={macro.newPriority ?? ""} className={fieldClass}>
                            <option value="">— brak zmian —</option>
                            {ticketPriorities.map((priority) => (
                              <option key={priority} value={priority}>
                                {priorityLabels[priority as TicketPriority]}
                              </option>
                            ))}
                          </select>
                          <label className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 text-xs font-bold dark:border-white/10 dark:bg-white/10">
                            <input type="checkbox" name="isActive" defaultChecked={macro.isActive} className="h-4 w-4" />
                            Aktywne
                          </label>
                          <button className="h-10 rounded-md bg-ink px-4 text-sm font-bold text-white dark:bg-paper dark:text-ink" type="submit">
                            Zapisz
                          </button>
                          <textarea
                            name="body"
                            defaultValue={macro.body ?? ""}
                            className="col-span-full min-h-20 resize-y rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper"
                          />
                        </form>
                        <form action={deleteMacroAdminAction}>
                          <input type="hidden" name="id" value={macro.id} />
                          <button
                            type="submit"
                            className="inline-flex h-10 items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 text-sm font-bold text-red-600 dark:text-red-400"
                          >
                            <Trash2 size={16} />
                            Usuń
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-ink/55 dark:text-paper/55">Brak makr.</p>
      )}
    </AppShell>
  );
}

const fieldClass =
  "h-10 w-full min-w-0 rounded-md border border-black/10 bg-white px-3 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/15 dark:border-white/10 dark:bg-white/10 dark:text-paper";