import { describe, expect, it } from "vitest";
import { getSettingsTilesForUser } from "@/lib/admin-navigation";

describe("settings tiles", () => {
  it("shows only reports to an agent", () => {
    const tiles = getSettingsTilesForUser({ role: "AGENT" });

    expect(tiles.map((tile) => tile.label)).toEqual(["Raporty"]);
  });

  it("shows all settings to an administrator", () => {
    const tiles = getSettingsTilesForUser({ role: "ADMIN" });

    expect(tiles.map((tile) => tile.label)).toEqual(["Raporty", "Użytkownicy", "Sklepy", "Kategorie", "Szablony"]);
  });
});
