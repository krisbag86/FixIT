import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth";
import { getWeeklySchedule } from "@/lib/data-store";
import { formatDateLabel, parseDateOnly } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getScheduleWeekDays, resolveScheduleWeekStart } from "@/lib/schedule";

export const dynamic = "force-dynamic";

const dayNameFormatter = new Intl.DateTimeFormat("pl-PL", { weekday: "long", timeZone: "UTC" });

export async function POST(request: Request): Promise<Response> {
  const user = await requireUser();

  if (!can(user, "schedule:view")) {
    return new Response("Brak uprawnień.", { status: 403 });
  }

  const formData = await request.formData();
  const requestedWeek = String(formData.get("weekStart") ?? "");
  if (!parseDateOnly(requestedWeek)) {
    return new Response("Nieprawidłowy tydzień grafiku.", { status: 400 });
  }

  const weekStart = resolveScheduleWeekStart(requestedWeek);
  const data = await getWeeklySchedule(weekStart);
  const days = getScheduleWeekDays(weekStart);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FixIT";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Grafik", {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  sheet.mergeCells("A1:H1");
  sheet.getCell("A1").value = "Grafik tygodniowy";
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF168F7A" } };
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 30;

  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").value = `${formatDateLabel(days[0])} – ${formatDateLabel(days[6])}`;
  sheet.getCell("A2").font = { bold: true, color: { argb: "FF334155" } };
  sheet.getCell("A2").alignment = { horizontal: "center" };

  const header = sheet.getRow(4);
  header.values = [
    "Osoba",
    ...days.map((day) => {
      const hasDuty = data.duties.some((duty) => duty.date === day);
      return `${formatDayHeader(day)}${hasDuty ? "" : "\nBRAK DYŻURU"}`;
    })
  ];
  header.height = 42;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  header.eachCell((cell, columnNumber) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: columnNumber >= 7 ? "FFD97706" : "FF334155" }
    };
  });

  sheet.getColumn(1).width = 24;
  for (let columnNumber = 2; columnNumber <= 8; columnNumber += 1) {
    sheet.getColumn(columnNumber).width = 31;
  }

  if (data.members.length === 0) {
    sheet.mergeCells("A5:H5");
    sheet.getCell("A5").value = "Brak członków grafiku w wybranym tygodniu.";
    sheet.getCell("A5").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(5).height = 36;
  } else {
    for (const member of data.members) {
      const historical = !member.isActive || !member.isScheduleMember || (member.role !== "AGENT" && member.role !== "ADMIN");
      const rowValues = [
        `${member.name || member.email}${member.department ? `\n${member.department}` : ""}${historical ? "\n(historyczny)" : ""}`,
        ...days.map((day) => formatScheduleCell(data, member.id, day))
      ];
      const row = sheet.addRow(rowValues);
      const lineCount = Math.max(...rowValues.map((value) => value.split("\n").length));
      row.height = Math.min(180, Math.max(42, lineCount * 15));
      row.alignment = { vertical: "top", wrapText: true };
      row.getCell(1).font = { bold: true };
      row.getCell(7).fill = weekendFill;
      row.getCell(8).fill = weekendFill;
    }
  }

  for (let rowNumber = 4; rowNumber <= sheet.rowCount; rowNumber += 1) {
    sheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right: { style: "thin", color: { argb: "FFD1D5DB" } }
      };
    });
  }

  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: 4 }];
  sheet.autoFilter = "A4:H4";
  sheet.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="fixit-grafik-${weekStart}.xlsx"`
    }
  });
}

function formatDayHeader(date: string): string {
  const [, month, day] = date.split("-");
  const name = dayNameFormatter.format(new Date(`${date}T12:00:00Z`));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}\n${day}.${month}`;
}

function formatScheduleCell(
  data: Awaited<ReturnType<typeof getWeeklySchedule>>,
  memberId: string,
  date: string
): string {
  const lines: string[] = [];
  if (data.duties.some((duty) => duty.date === date && duty.assigneeId === memberId)) {
    lines.push("DYŻUR");
  }

  for (const task of data.tasks.filter((entry) => entry.date === date && entry.assigneeId === memberId)) {
    lines.push(`${task.isCompleted ? "✓" : "○"} ${task.title}`);
    if (task.description) {
      lines.push(task.description);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "Brak zadań";
}

const weekendFill: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF7E6" }
};
