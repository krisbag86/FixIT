import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => resetDatabase());

test("collapses advanced ticket filters while keeping search available", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/tickets");

  const toggle = page.getByTestId("ticket-filters-toggle");
  await expect(page.getByLabel("Szukaj ticketów")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("ticket-filters-panel")).toBeHidden();

  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("ticket-filters-panel")).toBeVisible();
  await expect(page.getByLabel("Filtruj po statusie")).toBeVisible();
});

test("expands ticket filters when a filter is active", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/tickets?status=IN_PROGRESS");

  await expect(page.getByTestId("ticket-filters-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("ticket-filters-panel")).toBeVisible();
  await expect(page.getByLabel("Filtruj po statusie")).toHaveValue("IN_PROGRESS");
});

test("renders stores as editable cards instead of a table", async ({ page }) => {
  await loginAs(page, "admin@bagietka.pl");
  await page.goto("/admin/stores");

  const cards = page.getByTestId("store-card");
  await expect(cards.first()).toBeVisible();
  await expect(cards.first().locator('input[name="code"]')).toBeVisible();
  await expect(cards.first().locator('input[name="address"]')).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);
});
