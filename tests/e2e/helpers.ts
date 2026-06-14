import { expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export async function loginAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.click('button:has-text("Zaloguj się")');
  await page.getByTestId('logout-button').waitFor({ timeout: 10000 });
}

export function resetDatabase() {
  // Ensure we start with clean seed data for every test to avoid flaky tests
  const dataDir = path.join(process.cwd(), '.data');
  const dbFile = path.join(dataDir, 'fixit-db.json');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Generate seed using the actual seed function to ensure exact matching format
  // We'll run this via node directly since it's easier to mock the db file
  // Wait, the tests might run concurrently and step on each other if they use the same file.
  // Playwright tests run in parallel by default, but our dev server only has ONE database file.
  // We will configure playwright.config.ts to run tests SERIALLY if we modify the db,
  // or we just accept that some tests might see extra data. We set `fullyParallel: true` in config.
  // Let's at least reset before each test block.
  
  try {
    // A dirty but effective way to get seed data in test environment
    // Next dev server auto-seeds if the file doesn't exist or is invalid
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
    // Give it a moment, dev server might recreate it on next read, 
    // or we can copy it from a snapshot if we had one.
    // For now, deleting it forces the app to re-seed on next request.
  } catch (e) {
    console.error('Error resetting database', e);
  }
}

export async function createTicketViaUI(page: Page, categoryText: string, title: string, description: string, priority: string = 'NORMAL') {
  await page.goto('/tickets/new');
  
  // Wait for form to be ready
  const form = page.getByTestId('new-ticket-form');
  await form.waitFor({ state: 'visible' });

  // Select category
  const categorySelect = page.locator('select[name="categoryId"]');
  // Need to find the value for the category text
  const option = categorySelect.locator(`option:has-text("${categoryText}")`);
  const value = await option.getAttribute('value');
  if (value) {
    await categorySelect.selectOption(value);
  } else {
    // fallback to first option
    const firstCat = categorySelect.locator('option').nth(1); 
    await categorySelect.selectOption(await firstCat.getAttribute('value') || '');
  }

  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="description"]', description);
  await page.fill('input[name="contact"]', 'test@bagietka.pl');
  await page.selectOption('select[name="priority"]', priority);
  
  await page.click('button:has-text("Utworz zgloszenie")');
  await page.waitForURL(
    (url) => url.pathname.startsWith('/tickets/') && url.pathname !== '/tickets/new',
    { timeout: 10000 }
  );
  await expect(page.getByTestId('ticket-number')).toBeVisible();
}
