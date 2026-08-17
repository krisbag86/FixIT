import { expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export async function loginAs(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'TestPassword123!');
  await page.locator('input[type="checkbox"]').check();
  await page.click('button:has-text("Zaloguj się")');
  await page.getByTestId('logout-button').waitFor({ timeout: 30000 });
}

export async function submitLogin(page: Page, email: string, password = 'TestPassword123!') {
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.locator('input[type="checkbox"]').check();
  await page.click('button:has-text("Zaloguj się")');
}

export function resetDatabase() {
  // The Playwright web server runs against an isolated JSON E2E fixture.
  // Removing it makes the next request recreate the deterministic fixture.
  const dataDir = path.join(process.cwd(), '.data');
  const dbFile = path.join(dataDir, 'fixit-db.json');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  try {
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
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
  
  await form.getByRole('button', { name: /Utwórz zgłoszenie/i }).click();
  await page.waitForURL(
    (url) => url.pathname.startsWith('/tickets/') && url.pathname !== '/tickets/new',
    { timeout: 10000 }
  );
  await expect(page.getByTestId('ticket-number')).toBeVisible();
}
