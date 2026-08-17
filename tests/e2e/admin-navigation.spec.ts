import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => resetDatabase());

test("admin sees grouped navigation and all settings tiles", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/settings");

  await expect(page.getByRole("heading", { name: "Ustawienia" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Raporty/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Użytkownicy/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Sklepy/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Szablony/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Kategorie/ })).toBeVisible();
  await expect(page.getByTestId("settings-grid")).toHaveCount(1);
  await expect(page.locator('[data-nav-group="Ustawienia"] a')).toHaveAttribute("aria-current", "page");

  await page.goto("/admin/daylog");
  await expect(page.locator('[data-nav-group="Narzędzia operacyjne"] a[href="/admin/daylog"]')).toHaveClass(/bg-mint/);
  await expect(page.locator('[data-nav-group="Narzędzia operacyjne"] a[href="/admin/schedule"]')).toBeVisible();
});

test("agent sees reports but not admin-only settings tiles", async ({ page }) => {
  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/admin/settings");

  await expect(page.getByRole("link", { name: /Raporty/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Użytkownicy/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Sklepy/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Szablony/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Kategorie/ })).toHaveCount(0);
});
