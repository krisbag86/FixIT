import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayLogEntry, User } from "@/lib/types";

vi.mock("server-only", () => ({}));

const adminUser: User = {
  id: "usr_admin",
  name: "Admin",
  email: "admin@bagietka.pl",
  role: "ADMIN",
  isActive: true
};

const entries: DayLogEntry[] = [
  {
    id: "daylog_1",
    occurredAt: "2026-08-04T12:30:00.000Z",
    fromName: "Sklep Warszawa",
    subject: "Awaria kasy",
    description: "Kasa nie drukuje paragonów.",
    createdById: adminUser.id,
    createdByName: "Krzysztof Graczyk",
    createdByEmail: "krzysztofgraczyk@bagietka.pl",
    createdAt: "2026-08-04T12:35:00.000Z",
    updatedAt: "2026-08-04T12:35:00.000Z"
  },
  {
    id: "daylog_2",
    occurredAt: "2026-08-04T09:00:00.000Z",
    fromName: "Sklep Kraków",
    subject: "Brak internetu",
    description: "Restart routera pomógł.",
    createdById: "usr_agent",
    createdByEmail: "agent@bagietka.pl",
    createdAt: "2026-08-04T09:05:00.000Z",
    updatedAt: "2026-08-04T09:05:00.000Z"
  },
  {
    id: "daylog_3",
    occurredAt: "2026-08-04T08:00:00.000Z",
    fromName: "Centrala",
    subject: "Pytanie o konto",
    description: "Przekazano instrukcję resetu hasła.",
    createdById: "usr_deleted",
    createdAt: "2026-08-04T08:05:00.000Z",
    updatedAt: "2026-08-04T08:05:00.000Z"
  }
];

function installMocks(user: User, result: DayLogEntry[] = entries) {
  const listDayLogEntries = vi.fn(async () => result);
  vi.doMock("@/lib/auth", () => ({
    requireUser: vi.fn(async () => user)
  }));
  vi.doMock("@/lib/data-store", () => ({
    listDayLogEntries
  }));
  return { listDayLogEntries };
}

describe("DayLog Excel export", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/data-store");
  });

  it("returns 403 without reading entries when the user lacks access", async () => {
    const reporter: User = { ...adminUser, id: "usr_reporter", role: "REPORTER" };
    const { listDayLogEntries } = installMocks(reporter);
    const { POST } = await import("@/app/admin/daylog/export/route");

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe("Brak uprawnień.");
    expect(listDayLogEntries).not.toHaveBeenCalled();
  });

  it("returns a formatted workbook with all DayLog entries", async () => {
    const { listDayLogEntries } = installMocks(adminUser);
    const { POST } = await import("@/app/admin/daylog/export/route");

    const response = await POST();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="fixit-daylog-\d{4}-\d{2}-\d{2}\.xlsx"$/
    );
    expect(listDayLogEntries).toHaveBeenCalledOnce();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const sheet = workbook.getWorksheet("DayLog");

    expect(sheet).toBeDefined();
    expect(sheet!.getRow(1).values).toEqual([
      undefined,
      "Data i godzina",
      "Od kogo",
      "Temat",
      "Opis",
      "Dodał administrator"
    ]);
    expect(sheet!.getCell("A2").text).toContain("14:30");
    expect(sheet!.getCell("B2").text).toBe("Sklep Warszawa");
    expect(sheet!.getCell("C2").text).toBe("Awaria kasy");
    expect(sheet!.getCell("D2").text).toBe("Kasa nie drukuje paragonów.");
    expect(sheet!.getCell("E2").text).toBe("Krzysztof Graczyk");
    expect(sheet!.getCell("E3").text).toBe("agent@bagietka.pl");
    expect(sheet!.getCell("E4").text).toBe("Administrator");
    expect(sheet!.views).toEqual([expect.objectContaining({ state: "frozen", ySplit: 1 })]);
    expect(sheet!.autoFilter).toBe("A1:E1");
  });
});
