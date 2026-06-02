import { describe, expect, it } from "vitest";
import { buildAuditPayload, describeAuditChanges, getCategoryUsageSummary, getStoreUsageSummary, getUserAuditChanges } from "@/lib/admin-utils";
import { createSeedDatabase } from "@/lib/seed";

describe("admin utils", () => {
  it("builds audit payloads and readable summaries for user changes", () => {
    const database = createSeedDatabase();
    const before = database.users.find((user) => user.id === "usr_admin");

    expect(before).toBeDefined();

    const changes = getUserAuditChanges(before!, {
      role: "AGENT",
      storeId: "store_krk02",
      department: "Biuro",
      isActive: false
    });

    expect(changes).toHaveLength(4);
    expect(buildAuditPayload(changes)).toMatchObject({
      rolaFrom: "ADMIN",
      rolaTo: "AGENT",
      sklepFrom: "-",
      sklepTo: "store_krk02"
    });
    expect(describeAuditChanges("Uzytkownik", before!.email, changes)).toContain("rola ADMIN -> AGENT");
  });

  it("counts store and category usage before delete", () => {
    const database = createSeedDatabase();

    // seed has 0 users assigned to store_waw01 and 0 tickets
    expect(getStoreUsageSummary(database, "store_waw01")).toEqual({ userCount: 0, ticketCount: 0 });
    // cat_terminal has 0 tickets but 1 knowledge article
    expect(getCategoryUsageSummary(database, "cat_terminal")).toEqual({ ticketCount: 0, articleCount: 1 });
    expect(getCategoryUsageSummary(database, "cat_other")).toEqual({ ticketCount: 0, articleCount: 0 });
  });
});
