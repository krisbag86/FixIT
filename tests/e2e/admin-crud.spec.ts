import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => resetDatabase());

test("admin can create, update, and delete a category", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/categories");

  const createForm = page.locator("section").filter({ hasText: "Dodaj kategorię" }).locator("form");
  await createForm.locator('input[name="name"]').fill("E2E category");
  await createForm.getByRole("button", { name: "Dodaj" }).click();

  const createdRow = page.locator("tr").filter({ hasText: "E2E category" });
  await expect(createdRow).toBeVisible();

  await createdRow.locator('input[name="name"]').fill("E2E category updated");
  await createdRow.getByRole("button", { name: "Zapisz" }).click();
  const updatedRow = page.locator("tr").filter({ hasText: "E2E category updated" });
  await expect(updatedRow).toBeVisible();

  await updatedRow.getByRole("button", { name: "Usuń" }).click();
  await expect(page.locator("tr").filter({ hasText: "E2E category updated" })).toHaveCount(0);
});
