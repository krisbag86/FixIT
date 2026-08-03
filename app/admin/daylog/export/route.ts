import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth";
import { listDayLogEntries } from "@/lib/data-store";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const user = await requireUser();

  if (!can(user, "ticket:view-all")) {
    return new Response("Brak uprawnień.", { status: 403 });
  }

  const entries = await listDayLogEntries();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FixIT";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("DayLog");

  sheet.columns = [
    { header: "Data i godzina", key: "occurredAt", width: 22 },
    { header: "Od kogo", key: "fromName", width: 28 },
    { header: "Temat", key: "subject", width: 36 },
    { header: "Opis", key: "description", width: 70 },
    { header: "Dodał administrator", key: "createdBy", width: 30 }
  ];

  for (const entry of entries) {
    sheet.addRow({
      occurredAt: formatDateTime(entry.occurredAt),
      fromName: entry.fromName,
      subject: entry.subject,
      description: entry.description,
      createdBy: entry.createdByName ?? entry.createdByEmail ?? "Administrator"
    });
  }

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF168F7A" } };
  header.alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "E1" };
  sheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: "top", wrapText: true };
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FAF7" } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="fixit-daylog-${new Date().toISOString().slice(0, 10)}.xlsx"`
    }
  });
}
