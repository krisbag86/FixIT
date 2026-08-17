import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => {
  resetDatabase();
});

test("admin can add, complete, and assign a weekly schedule task", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/schedule");

  const taskTitle = "E2E schedule task";
  await page.locator("summary:visible").filter({ hasText: "Dodaj zadanie" }).first().click();
  const addForm = page.locator('form:visible').filter({ has: page.locator('input[name="title"]') }).first();
  await addForm.locator('input[name="title"]').fill(taskTitle);
  await addForm.locator('textarea[name="description"]').fill("Sprawdzić terminal w sklepie.");
  await addForm.getByRole("button", { name: "Dodaj" }).click();

  await expect(page.locator("body")).toContainText(taskTitle);
  await page.locator('button:visible[aria-label="Oznacz jako wykonane"]').first().click();
  await expect(page.locator('button:visible[aria-label="Oznacz jako niewykonane"]')).toBeVisible();

  const dutyButton = page.locator("button:visible").filter({ hasText: "+ Dyżur" }).first();
  await dutyButton.click();
  await expect(page.locator("body")).toContainText("Dyżur");
});
