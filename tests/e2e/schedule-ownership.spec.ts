import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => resetDatabase());

test("an agent cannot complete a task assigned to another schedule member", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/schedule");

  const title = "E2E ownership task";
  const details = page.locator("details:visible").filter({ has: page.locator('input[name="assigneeId"][value="usr_e2e_admin"]') }).first();
  await details.locator("summary").click();
  const addForm = details.locator("form");
  await addForm.locator('input[name="title"]').fill(title);
  await addForm.getByRole("button", { name: "Dodaj" }).click();
  await expect(page.locator('[data-testid="schedule-task"]:visible').filter({ hasText: title }).first()).toBeVisible();

  await loginAs(page, "agent@bagietka.pl");
  await page.goto("/admin/schedule");
  const task = page.locator('[data-testid="schedule-task"]:visible').filter({ hasText: title }).first();
  await expect(task).toBeVisible();
  await expect(task.getByRole("button", { name: "Oznacz jako wykonane" })).toHaveCount(0);
});
