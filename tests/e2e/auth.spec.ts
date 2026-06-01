import { test, expect } from '@playwright/test';

test.describe('Authentication - bagietka.pl domain', () => {
  test('should allow login with valid bagietka.pl email', async ({ page }) => {
    await page.goto('/login');
    
    // Check page loads
    expect(await page.locator('h1:has-text("FixIT Helpdesk")').isVisible()).toBeTruthy();
    
    // Fill form with valid email
    await page.fill('input[name="email"]', 'admin@bagietka.pl');
    
    // Submit form
    await page.click('button:has-text("Wejdz do FixIT")');
    
    // Should redirect to home page
    await page.waitForURL('/admin/tickets', { timeout: 5000 });
    expect(page.url()).toContain('/admin/tickets');
  });

  test('should reject login with invalid domain email', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with non-bagietka.pl email
    await page.fill('input[name="email"]', 'user@example.com');
    await page.click('button:has-text("Wejdz do FixIT")');
    
    // Should show error message
    const errorMessage = page.locator('p:has-text("Podaj sluzbowy adres")');
    await expect(errorMessage).toBeVisible();
    
    // Should still be on login page
    expect(page.url()).toContain('/login');
  });

  test('should reject login with invalid email format', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with invalid email format
    await page.fill('input[name="email"]', 'not-an-email');
    await page.click('button:has-text("Wejdz do FixIT")');
    
    // Should show validation error
    const errorMessage = page.locator('text=/invalid|incorrect|wrong/i');
    await expect(errorMessage).toBeVisible();
  });

  test('should normalize email addresses', async ({ page }) => {
    await page.goto('/login');
    
    // Try with uppercase and spaces
    await page.fill('input[name="email"]', '  ADMIN@BAGIETKA.PL  ');
    await page.click('button:has-text("Wejdz do FixIT")');
    
    // Should still work (normalize to lowercase)
    await page.waitForURL('/admin/tickets', { timeout: 5000 });
    expect(page.url()).toContain('/admin/tickets');
  });
});

test.describe('Authentication - logout', () => {
  test('should logout user and redirect to login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@bagietka.pl');
    await page.click('button:has-text("Wejdz do FixIT")');
    await page.waitForURL('/admin/tickets');
    
    // Find and click logout button (usually in navigation)
    const logoutButton = page.locator('button:has-text("Wyloguj")');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL('/login');
      expect(page.url()).toContain('/login');
    }
  });
});
