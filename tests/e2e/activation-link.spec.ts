import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => resetDatabase());

test("admin can activate a newly invited user through the fallback link", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/users");

  const email = "e2e.activation@bagietka.pl";
  const form = page.locator("form").filter({ has: page.locator('input[name="email"]') }).first();
  await form.locator('input[name="name"]').fill("E2E Activation User");
  await form.locator('input[name="email"]').fill(email);
  await form.getByRole("button", { name: "Dodaj" }).click();

  const activationLink = page.locator('input[readonly]').first();
  await expect(activationLink).toHaveValue(/\/setup\//);
  const setupUrl = await activationLink.inputValue();

  await page.goto(setupUrl);
  await page.fill('input[name="password"]', "ActivatedPassword123!");
  await page.fill('input[name="confirmPassword"]', "ActivatedPassword123!");
  await page.getByRole("button", { name: /Ustaw hasło/i }).click();
  await page.getByTestId("logout-button").waitFor({ timeout: 30000 });
  await page.getByTestId("logout-button").click();

  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "ActivatedPassword123!");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await page.getByTestId("logout-button").waitFor({ timeout: 30000 });
});
