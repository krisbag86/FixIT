import { requireUser } from "@/lib/auth";
import { exportTicketsCSV } from "@/lib/data-store";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const user = await requireUser();

  if (!can(user, "ticket:view-all")) {
    return new Response("Brak uprawnien.", { status: 403 });
  }

  const csv = await exportTicketsCSV();

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fixit-tickets-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
