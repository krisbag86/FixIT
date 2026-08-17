import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => resetDatabase());

test("reporter sees a simple dashboard with only their active tickets", async ({ page }) => {
  await loginAs(page, "kasjer@bagietka.pl");
  await page.goto("/tickets");

  await expect(page.getByRole("heading", { name: "W czym możemy pomóc?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zgłoś problem" })).toBeVisible();
  await expect(page.getByTestId("requester-ticket-card").first()).toBeVisible();
  await expect(page.getByLabel("Szukaj zgłoszeń")).toHaveCount(0);
  await expect(page.getByLabel("Filtruj po statusie")).toHaveCount(0);
});

test("requester navigation contains only portal destinations", async ({ page }) => {
  await loginAs(page, "kasjer@bagietka.pl");
  await page.goto("/tickets");

  for (const label of ["Moje zgłoszenia", "Nowe", "Archiwum", "Baza wiedzy"]) {
    await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Mój sklep" })).toHaveCount(0);
});

test("store manager uses the same requester navigation", async ({ page }) => {
  await loginAs(page, "sklep.waw01@bagietka.pl");
  await page.goto("/tickets");

  await expect(page.getByRole("heading", { name: "W czym możemy pomóc?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mój sklep" })).toHaveCount(0);
});

test("requester archive has no technical filters", async ({ page }) => {
  await loginAs(page, "kasjer@bagietka.pl");
  await page.goto("/tickets/archive");

  await expect(page.getByRole("heading", { name: "Archiwum zgłoszeń" })).toBeVisible();
  await expect(page.locator('input[name="q"]')).toHaveCount(0);
  await expect(page.locator('select[name="status"]')).toHaveCount(0);
});

test("requester form keeps only essential fields and FAQ", async ({ page }) => {
  await loginAs(page, "kasjer@bagietka.pl");
  await page.goto("/tickets/new");

  await expect(page.getByTestId("requester-ticket-form")).toBeVisible();
  await expect(page.locator('select[name="categoryId"]')).toBeVisible();
  await expect(page.locator('input[name="title"]')).toBeVisible();
  await expect(page.locator('textarea[name="description"]')).toBeVisible();
  await expect(page.locator('input[name="contact"]')).toBeVisible();
  await expect(page.locator("#faq-suggestions")).toBeVisible();
  await expect(page.locator('select[name="priority"]')).toHaveCount(0);
  await expect(page.locator('select[name="storeId"]')).toHaveCount(0);
  await expect(page.locator('input[name="blocksWork"]')).toHaveCount(0);
});
