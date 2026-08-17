import { test, expect } from "@playwright/test";
import { generateTotpCode } from "../../lib/mfa";
import { loginAs, resetDatabase, submitLogin } from "./helpers";

test.beforeEach(() => {
  resetDatabase();
});

test("admin can enable MFA and must verify it on the next login", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/users");

  await page.getByRole("button", { name: "Rozpocznij konfigurację MFA" }).click();
  const secret = (await page.locator("code").textContent())?.trim();
  expect(secret).toBeTruthy();

  const setupForm = page.locator('form:visible').filter({ has: page.locator('input[name="code"]') });
  await setupForm.locator('input[name="code"]').fill(generateTotpCode(secret!));
  await setupForm.getByRole("button", { name: "Potwierdź MFA" }).click();
  await expect(page.locator("body")).toContainText("MFA zostało włączone");

  await page.getByTestId("logout-button").click();
  await page.waitForURL("/login");
  await submitLogin(page, "admin@bagietka.pl");
  await page.waitForURL("/mfa");

  await page.locator('input[name="code"]').fill(generateTotpCode(secret!));
  await page.getByRole("button", { name: "Potwierdź" }).click();
  await page.waitForURL("/admin/dashboard");
  await expect(page.getByTestId("logout-button")).toBeVisible();
});
