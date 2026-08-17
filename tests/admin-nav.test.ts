import { describe, expect, it } from "vitest";
import { getAdminNavGroups, isSettingsPath } from "@/lib/admin-navigation";

describe("AdminNav", () => {
  it("groups settings routes behind one settings link", () => {
    const groups = getAdminNavGroups({ role: "ADMIN" });
    const settingsLinks = groups.flatMap((group) => group.links).filter((link) => link.href === "/admin/settings");

    expect(settingsLinks).toHaveLength(1);
    expect(groups.map((group) => group.label)).toContain("Ustawienia");
    expect(settingsLinks[0]?.label).toBe("Ustawienia");
    expect(isSettingsPath("/admin/users")).toBe(true);
  });

  it("keeps DayLog and Grafik visible as operational tools", () => {
    const groups = getAdminNavGroups({ role: "ADMIN" });
    const operational = groups.find((group) => group.label === "Narzędzia operacyjne");

    expect(operational?.links.map((link) => link.label)).toEqual(["DayLog", "Grafik"]);
  });
});
