import { test, expect } from "@playwright/test";
import { createTicketViaUI, loginAs, resetDatabase } from "./helpers";

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

test("reporter sees public progress and can send a short public reply", async ({ page }) => {
  await loginAs(page, "kasjer@bagietka.pl");
  await page.goto("/tickets/t_001");

  await expect(page.getByTestId("requester-ticket-detail")).toBeVisible();
  await expect(page.getByTestId("public-ticket-progress")).toContainText("W trakcie");
  await expect(page.getByTestId("requester-reply-form")).toBeVisible();
  await expect(page.getByTestId("requester-reply-form").locator('select[name="visibility"]')).toHaveCount(0);
  await expect(page.getByTestId("requester-ticket-detail")).not.toContainText("Priorytet");
  await expect(page.getByTestId("requester-ticket-detail")).not.toContainText("SLA");
  await expect(page.getByTestId("requester-ticket-detail")).not.toContainText("Prowadzi");

  await page.getByTestId("requester-reply-form").locator("textarea").fill("To nadal nie działa.");
  await page.getByTestId("requester-reply-form").getByRole("button", { name: "Wyślij odpowiedź" }).click();
  await expect(page.locator("body")).toContainText("To nadal nie działa.");
});

test("reporter cannot open another user's ticket by direct URL", async ({ page }) => {
  await loginAs(page, "kasjer@bagietka.pl");
  await page.goto("/tickets/t_002");

  await expect(page.getByTestId("requester-ticket-detail")).toHaveCount(0);
  await expect(page.getByTestId("ticket-number")).toHaveCount(0);
});

test("reporter can confirm a resolved own ticket", async ({ page, browser }) => {
  await loginAs(page, "kasjer@bagietka.pl");
  await createTicketViaUI(page, "Inne", "Resolution confirmation test", "Ticket used to verify the requester resolution action.");
  const reporterUrl = page.url();
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();

  await loginAs(adminPage, "admin@bagietka.pl");
  await adminPage.goto(reporterUrl.replace("/tickets/", "/admin/tickets/"));
  const adminActions = adminPage.getByTestId("admin-actions");
  await adminActions.locator('select[name="status"]').selectOption("RESOLVED");
  const [updateResponse] = await Promise.all([
    adminPage.waitForResponse((response) => response.request().method() === "POST"),
    adminActions.getByRole("button", { name: "Zapisz zmiany" }).click()
  ]);
  expect(updateResponse.status()).toBeLessThan(400);
  await adminContext.close();

  await page.goto(reporterUrl);
  await expect(page.getByRole("button", { name: "Potwierdź i zamknij zgłoszenie" })).toBeVisible();
});
