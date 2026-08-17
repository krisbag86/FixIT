import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => {
  resetDatabase();
});

test("admin can create a DayLog entry and start a ticket from it", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/daylog");

  const subject = "E2E DayLog incident";
  const form = page.locator("details form:visible");
  await page.getByText("Nowy wpis", { exact: true }).click();
  await form.locator('input[name="occurredAt"]').fill("2026-08-17T10:30");
  await form.locator('input[name="fromName"]').fill("Sklep E2E");
  await form.locator('input[name="subject"]').fill(subject);
  await form.locator('textarea[name="description"]').fill("Drukarka fiskalna przestała odpowiadać po restarcie.");
  await form.getByRole("button", { name: "Zapisz wpis" }).click();

  const entry = page.locator("article").filter({ hasText: subject });
  await expect(entry).toBeVisible();
  await entry.getByRole("link", { name: "Utwórz zgłoszenie" }).click();
  await page.waitForURL(/\/tickets\/new\?fromDayLog=/);

  await expect(page.locator('input[name="title"]')).toHaveValue(subject);
  await expect(page.locator('textarea[name="description"]')).toHaveValue("Drukarka fiskalna przestała odpowiadać po restarcie.");
  await expect(page.locator('input[name="contact"]')).toHaveValue("Sklep E2E");
});
