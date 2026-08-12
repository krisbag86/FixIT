import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User, WeeklyScheduleData } from "@/lib/types";

vi.mock("server-only", () => ({}));

const admin: User = {
  id: "usr_admin",
  name: "Administrator",
  email: "admin@bagietka.pl",
  role: "ADMIN",
  isActive: true,
  isScheduleMember: true
};

const agent: User = {
  ...admin,
  id: "usr_agent",
  name: "Agent",
  email: "agent@bagietka.pl",
  role: "AGENT",
  department: "IT"
};

const schedule: WeeklyScheduleData = {
  weekStart: "2026-08-10",
  members: [agent, admin],
  tasks: [
    {
      id: "task_1",
      date: "2026-08-10",
      title: "Sprawdzenie backupu",
      description: "Zweryfikować raport nocny.",
      isCompleted: false,
      assigneeId: agent.id,
      createdById: admin.id,
      updatedById: admin.id,
      createdAt: "2026-08-10T08:00:00.000Z",
      updatedAt: "2026-08-10T08:00:00.000Z"
    },
    {
      id: "task_2",
      date: "2026-08-16",
      title: "Kontrola dyżuru",
      isCompleted: true,
      assigneeId: admin.id,
      createdById: admin.id,
      updatedById: admin.id,
      createdAt: "2026-08-10T08:00:00.000Z",
      updatedAt: "2026-08-10T08:00:00.000Z"
    }
  ],
  duties: [
    { id: "duty_1", date: "2026-08-10", assigneeId: agent.id, createdById: admin.id, createdAt: "2026-08-10T08:00:00.000Z" },
    { id: "duty_2", date: "2026-08-16", assigneeId: admin.id, createdById: admin.id, createdAt: "2026-08-10T08:00:00.000Z" }
  ]
};

function installMocks(user: User, data: WeeklyScheduleData = schedule) {
  const getWeeklySchedule = vi.fn(async () => data);
  vi.doMock("@/lib/auth", () => ({ requireUser: vi.fn(async () => user) }));
  vi.doMock("@/lib/data-store", () => ({ getWeeklySchedule }));
  return { getWeeklySchedule };
}

function exportRequest(weekStart = "2026-08-10") {
  const formData = new FormData();
  formData.set("weekStart", weekStart);
  return new Request("http://localhost/admin/schedule/export", { method: "POST", body: formData });
}

describe("weekly schedule Excel export", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/data-store");
  });

  it("returns 403 without reading the schedule when the user lacks access", async () => {
    const reporter: User = { ...admin, id: "usr_reporter", role: "REPORTER" };
    const { getWeeklySchedule } = installMocks(reporter);
    const { POST } = await import("@/app/admin/schedule/export/route");

    const response = await POST(exportRequest());

    expect(response.status).toBe(403);
    expect(getWeeklySchedule).not.toHaveBeenCalled();
  });

  it("rejects an invalid week before reading schedule data", async () => {
    const { getWeeklySchedule } = installMocks(agent);
    const { POST } = await import("@/app/admin/schedule/export/route");

    const response = await POST(exportRequest("not-a-date"));

    expect(response.status).toBe(400);
    expect(getWeeklySchedule).not.toHaveBeenCalled();
  });

  it("exports duties, tasks, completion status and weekend formatting", async () => {
    const { getWeeklySchedule } = installMocks(agent);
    const { POST } = await import("@/app/admin/schedule/export/route");

    const response = await POST(exportRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="fixit-grafik-2026-08-10.xlsx"');
    expect(getWeeklySchedule).toHaveBeenCalledWith("2026-08-10");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const sheet = workbook.getWorksheet("Grafik");

    expect(sheet).toBeDefined();
    expect(sheet!.getCell("A1").text).toBe("Grafik tygodniowy");
    expect(sheet!.getCell("B4").text).toContain("Poniedziałek");
    expect(sheet!.getCell("C4").text).not.toContain("BRAK DYŻURU");
    expect(sheet!.getCell("G4").text).toContain("BRAK DYŻURU");
    expect(sheet!.getCell("H4").text).not.toContain("BRAK DYŻURU");
    expect(sheet!.getCell("A5").text).toContain("Agent");
    expect(sheet!.getCell("B5").text).toContain("DYŻUR");
    expect(sheet!.getCell("B5").text).toContain("○ Sprawdzenie backupu");
    expect(sheet!.getCell("H6").text).toContain("✓ Kontrola dyżuru");
    expect(sheet!.getCell("G5").fill).toEqual(expect.objectContaining({ type: "pattern" }));
    expect(sheet!.views).toEqual([expect.objectContaining({ state: "frozen", xSplit: 1, ySplit: 4 })]);
    expect(sheet!.autoFilter).toBe("A4:H4");
  });
});
