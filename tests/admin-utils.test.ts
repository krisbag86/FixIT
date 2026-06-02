import { describe, expect, it } from "vitest";
import { buildAuditPayload, describeAuditChanges, getCategoryUsageSummary, getStoreUsageSummary, getUserAuditChanges } from "@/lib/admin-utils";
import { createSeedDatabase } from "@/lib/seed";

describe("admin utils", () => {
  it("builds audit payloads and readable summaries for user changes", () => {
    const database = createSeedDatabase();
    const before = database.users.find((user) => user.id === "usr_reporter");

    expect(before).toBeDefined();

    const changes = getUserAuditChanges(before!, {
      role: "STORE_MANAGER",
      storeId: "store_krk02",
      department: "Sprzedaz",
      isActive: false
    });

    expect(changes).toHaveLength(4);
    expect(buildAuditPayload(changes)).toMatchObject({
      rolaFrom: "REPORTER",
      rolaTo: "STORE_MANAGER",
      sklepFrom: "store_waw01",
      sklepTo: "store_krk02"
    });
    expect(describeAuditChanges("Uzytkownik", before!.email, changes)).toContain("rola REPORTER -> STORE_MANAGER");
  });

  it("counts store and category usage before delete", () => {
    const database = createSeedDatabase();

    expect(getStoreUsageSummary(database, "store_waw01")).toEqual({ userCount: 2, ticketCount: 1 });
    expect(getCategoryUsageSummary(database, "cat_terminal")).toEqual({ ticketCount: 1, articleCount: 1 });
    expect(getCategoryUsageSummary(database, "cat_other")).toEqual({ ticketCount: 0, articleCount: 0 });
  });
});
