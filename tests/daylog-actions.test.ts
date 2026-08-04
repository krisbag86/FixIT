import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/types";

vi.mock("server-only", () => ({}));

const revalidatePathMock = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock
}));

const adminUser: User = {
  id: "usr_admin",
  name: "Admin",
  email: "admin@bagietka.pl",
  role: "ADMIN",
  isActive: true
};

function makeForm(overrides: Record<string, string> = {}): FormData {
  const values = {
    occurredAt: "2026-08-04T12:30:00.000Z",
    fromName: "  <b>Sklep Warszawa</b>  ",
    subject: "  Awaria <em>kasy</em>  ",
    description: "  Kasa <strong>nie drukuje</strong> paragonów.  ",
    ...overrides
  };
  const formData = new FormData();
  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

function installMocks(user: User = adminUser) {
  const createDayLogEntry = vi.fn(async () => ({}));
  vi.doMock("@/lib/auth", () => ({
    requireUser: vi.fn(async () => user)
  }));
  vi.doMock("@/lib/data-store", () => ({
    createDayLogEntry
  }));
  return { createDayLogEntry };
}

describe("createDayLogEntryAction", () => {
  beforeEach(() => {
    vi.resetModules();
    revalidatePathMock.mockReset();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/data-store");
  });

  it("sanitizes and stores a valid entry before refreshing DayLog", async () => {
    const { createDayLogEntry } = installMocks();
    const { createDayLogEntryAction } = await import("@/app/admin/daylog/actions");

    await createDayLogEntryAction(makeForm());

    expect(createDayLogEntry).toHaveBeenCalledWith({
      occurredAt: "2026-08-04T12:30:00.000Z",
      fromName: "Sklep Warszawa",
      subject: "Awaria kasy",
      description: "Kasa nie drukuje paragonów.",
      createdById: adminUser.id
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/admin/daylog");
  });

  it("interprets datetime-local values in the application timezone", async () => {
    const { createDayLogEntry } = installMocks();
    const { createDayLogEntryAction } = await import("@/app/admin/daylog/actions");

    await createDayLogEntryAction(makeForm({ occurredAt: "2026-08-04T12:30" }));

    expect(createDayLogEntry).toHaveBeenCalledWith(
      expect.objectContaining({ occurredAt: "2026-08-04T10:30:00.000Z" })
    );
  });

  it("rejects users without access to all tickets", async () => {
    const reporter: User = { ...adminUser, id: "usr_reporter", role: "REPORTER" };
    const { createDayLogEntry } = installMocks(reporter);
    const { createDayLogEntryAction } = await import("@/app/admin/daylog/actions");

    await expect(createDayLogEntryAction(makeForm())).rejects.toThrow("Brak uprawnień do dziennika administratorów.");
    expect(createDayLogEntry).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid occurrence date", async () => {
    const { createDayLogEntry } = installMocks();
    const { createDayLogEntryAction } = await import("@/app/admin/daylog/actions");

    await expect(createDayLogEntryAction(makeForm({ occurredAt: "not-a-date" }))).rejects.toThrow(
      "Podana data i godzina są nieprawidłowe."
    );
    expect(createDayLogEntry).not.toHaveBeenCalled();
  });

  it("validates required text after sanitization", async () => {
    const { createDayLogEntry } = installMocks();
    const { createDayLogEntryAction } = await import("@/app/admin/daylog/actions");

    await expect(createDayLogEntryAction(makeForm({ subject: "<script></script>" }))).rejects.toThrow("Podaj temat.");
    expect(createDayLogEntry).not.toHaveBeenCalled();
  });

  it("rejects a form with missing fields", async () => {
    const { createDayLogEntry } = installMocks();
    const { createDayLogEntryAction } = await import("@/app/admin/daylog/actions");

    await expect(createDayLogEntryAction(new FormData())).rejects.toThrow("Podaj datę i godzinę.");
    expect(createDayLogEntry).not.toHaveBeenCalled();
  });
});
