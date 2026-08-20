import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => resetDatabase());

test("agent sees operational dashboard and switches personal stages", async ({ page }) => {
  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/admin/dashboard");

  const alerts = page.getByTestId("dashboard-alerts");
  await expect(alerts).toContainText("Wymaga reakcji");
  await expect(alerts).toContainText("E2E critical overdue ticket");
  await expect(alerts.locator('a[href="/admin/tickets?attention=critical"]')).toHaveCount(1);
  await expect(alerts.locator('a[href="/admin/tickets?attention=overdue"]')).toHaveCount(1);
  await expect(alerts.locator('a[href="/admin/tickets?attention=all"]')).toHaveCount(1);
  await expect(page.getByTestId("dashboard-tab-new")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("dashboard-tabpanel")).toContainText("E2E new ticket");

  await page.getByTestId("dashboard-tab-waiting").click();
  await expect(page.getByTestId("dashboard-tab-waiting")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("dashboard-tabpanel")).toContainText("E2E waiting ticket");
  await expect(page.getByRole("link", { name: /Zobacz wszystkie oczekujące/i })).toHaveAttribute(
    "href",
    "/admin/tickets?mine=1&stage=waiting"
  );
});

test("dashboard tabs support keyboard navigation and mobile has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/admin/dashboard");
  await page.getByTestId("dashboard-tab-new").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("dashboard-tab-waiting")).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("dashboard remains usable in dark mode", async ({ page }) => {
  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/admin/dashboard");

  const root = page.locator("html");
  if (await root.evaluate((element) => element.classList.contains("dark"))) {
    await page.getByRole("button", { name: "Włącz jasny motyw" }).click();
  }
  await page.getByRole("button", { name: "Włącz ciemny motyw" }).click();

  await expect(root).toHaveClass(/dark/);
  await expect(page.getByTestId("dashboard-alerts")).toBeVisible();
  await expect(page.getByTestId("dashboard-my-tickets")).toBeVisible();
  await expect(page.getByTestId("dashboard-analytics")).toBeVisible();
});

test("administrator can access the IT dashboard", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByTestId("dashboard-alerts")).toBeVisible();
});

test("dashboard renders all empty states", async ({ page }) => {
  await loginAs(page, "agent@bagietka.pl");
  const databasePath = path.join(process.cwd(), ".data", "fixit-db.json");
  const database = JSON.parse(fs.readFileSync(databasePath, "utf8"));
  database.tickets = [];
  fs.writeFileSync(databasePath, JSON.stringify(database, null, 2));

  await page.goto("/admin/dashboard");
  await expect(page.getByTestId("dashboard-alerts")).toContainText("Brak krytycznych zgłoszeń i naruszeń SLA");
  await expect(page.getByTestId("dashboard-tabpanel")).toContainText("Nie masz nowych zgłoszeń");
  await page.getByTestId("dashboard-tab-waiting").click();
  await expect(page.getByTestId("dashboard-tabpanel")).toContainText("Nie masz oczekujących zgłoszeń");
  await page.getByTestId("dashboard-tab-in_progress").click();
  await expect(page.getByTestId("dashboard-tabpanel")).toContainText("Nie masz zgłoszeń w realizacji");
  await expect(page.getByTestId("dashboard-analytics")).toContainText("Brak danych do wyświetlenia wykresu.");
  await expect(page.getByTestId("dashboard-analytics")).toContainText("Brak danych.");
  await expect(page.getByTestId("dashboard-analytics")).toContainText("Brak przypisanych zgłoszeń.");
});

test("store manager cannot access the IT dashboard", async ({ page }) => {
  await loginAs(page, "sklep.waw01@bagietka.pl");
  await page.goto("/admin/dashboard");
  await expect(page).not.toHaveURL(/\/admin\/dashboard/);
});
