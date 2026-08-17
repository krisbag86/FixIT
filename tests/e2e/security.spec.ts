import { test, expect } from '@playwright/test';
import { createTicketViaUI, loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test('public registration remains disabled until email ownership verification exists', async ({ page }) => {
  await page.goto('/register');
  await page.fill('input[name="name"]', 'Unverified User');
  await page.fill('input[name="email"]', 'unverified@bagietka.pl');
  await page.fill('input[name="password"]', 'TestPassword123!');
  await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
  await page.locator('input[type="checkbox"]').check();
  await page.click('button:has-text("Załóż konto")');

  await expect(page.getByTestId('register-form')).toContainText('Rejestracja jest wyłączona');
});

test('agents cannot see unpublished knowledge articles', async ({ page }) => {
  await loginAs(page, 'agent@bagietka.pl');
  await page.goto('/admin/knowledge');

  await expect(page.locator('body')).toContainText('Szybki restart terminala płatniczego');
  await expect(page.locator('body')).not.toContainText('Jak zamówić nowy sprzęt IT');
});

test('reporters can see public responses added by IT', async ({ page, context }) => {
  await loginAs(page, 'sklep.waw01@bagietka.pl');
  await createTicketViaUI(page, 'Inne', 'Public response E2E', 'A reporter should receive the IT response.');
  const reporterUrl = page.url();

  const adminPage = await context.newPage();
  await loginAs(adminPage, 'admin@bagietka.pl');
  await adminPage.goto(reporterUrl.replace('/tickets/', '/admin/tickets/'));
  await adminPage.getByTestId('comment-form').locator('textarea[name="body"]').fill('IT odpowiedziało publicznie.');
  await adminPage.getByTestId('comment-form').locator('button[type="submit"]').click();
  await expect(adminPage.locator('body')).toContainText('IT odpowiedziało publicznie.');

  await page.reload();
  await expect(page.locator('body')).toContainText('IT odpowiedziało publicznie.');
  await adminPage.close();
});
