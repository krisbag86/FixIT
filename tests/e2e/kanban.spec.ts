import { test, expect } from "@playwright/test";
import { loginAs, resetDatabase } from "./helpers";

test.beforeEach(() => {
  resetDatabase();
});

test.describe("Kanban Board", () => {
  test("should display kanban page with columns for agent", async ({ page }) => {
    await loginAs(page, "agent@bagietka.pl");
    await page.goto("/admin/kanban");

    // Page title
    await expect(page.locator("h1")).toContainText("Kanban");

    // Should see all 8 status columns
    await expect(page.locator('[data-kanban-column="NEW"]')).toBeVisible();
    await expect(page.locator('[data-kanban-column="TRIAGED"]')).toBeVisible();
    await expect(page.locator('[data-kanban-column="IN_PROGRESS"]')).toBeVisible();
    await expect(page.locator('[data-kanban-column="WAITING_FOR_USER"]')).toBeVisible();
    await expect(page.locator('[data-kanban-column="WAITING_FOR_VENDOR"]')).toBeVisible();
    await expect(page.locator('[data-kanban-column="RESOLVED"]')).toBeVisible();
    await expect(page.locator('[data-kanban-column="CLOSED"]')).toBeVisible();
    await expect(page.locator('[data-kanban-column="CANCELLED"]')).toBeVisible();
  });

  test("should display ticket cards in correct columns from seed data", async ({ page }) => {
    await loginAs(page, "admin@bagietka.pl");
    await page.goto("/admin/kanban");

    // Seed data: t_001 has status IN_PROGRESS, t_002 has status NEW
    // Wait for cards to render
    const cards = page.getByTestId("kanban-card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // t_002 should be in NEW column
    const newColumn = page.locator('[data-kanban-column="NEW"]');
    await expect(newColumn).toContainText("IT-2026-0002");

    // t_001 should be in IN_PROGRESS column
    const inProgressColumn = page.locator('[data-kanban-column="IN_PROGRESS"]');
    await expect(inProgressColumn).toContainText("IT-2026-0001");
  });

  test("should show priority badge on each card", async ({ page }) => {
    await loginAs(page, "admin@bagietka.pl");
    await page.goto("/admin/kanban");

    const cards = page.getByTestId("kanban-card");
    await expect(cards.first()).toBeVisible();

    // Each card should have a priority badge (NORMAL, HIGH, etc)
    const cardCount = await cards.count();
    for (let i = 0; i < cardCount; i++) {
      const priorityBadge = cards.nth(i).locator("span").filter({ hasText: /NORMAL|WYSOKI|KRYTYCZNY|NISKI/ });
      await expect(priorityBadge).toBeVisible();
    }
  });

  test("should show column ticket counts", async ({ page }) => {
    await loginAs(page, "admin@bagietka.pl");
    await page.goto("/admin/kanban");

    // NEW column should have 1 ticket (t_002)
    const newColumn = page.locator('[data-kanban-column="NEW"]');
    await expect(newColumn.locator("span").filter({ hasText: "1" })).toBeVisible();

    // IN_PROGRESS column should have 1 ticket (t_001)
    const inProgressColumn = page.locator('[data-kanban-column="IN_PROGRESS"]');
    await expect(inProgressColumn.locator("span").filter({ hasText: "1" })).toBeVisible();
  });

  test("should move ticket to new column via drag and drop and update status", async ({ page }) => {
    await loginAs(page, "admin@bagietka.pl");
    await page.goto("/admin/kanban");

    // Wait for cards to be visible
    const cards = page.getByTestId("kanban-card");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // Get the first card (t_002 - in NEW column)
    const firstCard = cards.first();
    await expect(firstCard).toContainText("IT-2026-0002");

    // Register response listener BEFORE triggering the drag & drop
    const moveResponse = page.waitForResponse(
      (res) => res.url().includes("/admin/kanban/move") && res.status() === 204,
      { timeout: 10000 }
    );

    // Drag the first card from NEW column to IN_PROGRESS column
    await page.evaluate(() => {
      const source = document.querySelector('[data-testid="kanban-card"]');
      const target = document.querySelector('[data-kanban-column="IN_PROGRESS"]');
      if (!source || !target) throw new Error("Elements not found");

      const dt = new DataTransfer();

      const dragStart = new DragEvent("dragstart", { dataTransfer: dt, bubbles: true, cancelable: true });
      source.dispatchEvent(dragStart);

      const dragOver = new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true });
      target.dispatchEvent(dragOver);

      const drop = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true });
      target.dispatchEvent(drop);

      const dragEnd = new DragEvent("dragend", { dataTransfer: dt, bubbles: true, cancelable: true });
      source.dispatchEvent(dragEnd);
    });

    // Wait for the POST request to complete
    await moveResponse;

    // Wait for router.refresh() to re-render the page
    await expect(page.getByTestId("kanban-card").first()).toBeVisible({ timeout: 10000 });

    // The NEW column should no longer contain the moved ticket
    const newColumn = page.locator('[data-kanban-column="NEW"]');
    await expect(newColumn.getByTestId("kanban-card")).toHaveCount(0, { timeout: 5000 });

    // The IN_PROGRESS column should now have 2 cards (original t_001 + moved t_002)
    const inProgressColumn = page.locator('[data-kanban-column="IN_PROGRESS"]');
    const ipCards = inProgressColumn.getByTestId("kanban-card");
    await expect(ipCards).toHaveCount(2, { timeout: 5000 });

    // Verify t_002 now appears in IN_PROGRESS
    await expect(inProgressColumn).toContainText("IT-2026-0002");
  });

  test("should redirect reporter to /tickets when accessing kanban", async ({ page }) => {
    // Login as reporter (store manager - not admin/agent)
    await loginAs(page, "sklep.waw01@bagietka.pl");

    // Try to access kanban
    await page.goto("/admin/kanban");

    // Should be redirected away from admin/kanban
    expect(page.url()).not.toContain("/admin/kanban");
  });

  test("should highlight kanban nav link as active", async ({ page }) => {
    await loginAs(page, "admin@bagietka.pl");
    await page.goto("/admin/kanban");

    // AdminNav renders inside main, find the Kanban link
    const kanbanLink = page.locator('a[href="/admin/kanban"]').last();
    await expect(kanbanLink).toBeVisible();

    // Active link gets bg-ink (dark background) class
    await expect(kanbanLink).toHaveClass(/bg-ink/);
  });
});
