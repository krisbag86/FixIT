import { test, expect } from '@playwright/test';
import { resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test.describe('Authentication - bagietka.pl domain', () => {
  test('should allow login with valid bagietka.pl email', async ({ page }) => {
    await page.goto('/login');
    
    // Check page loads
    expect(await page.getByTestId('login-form').isVisible()).toBeTruthy();
    
    // Fill form with valid email
    await page.fill('input[name="email"]', 'admin@bagietka.pl');
    
    // Submit form
    await page.click('button:has-text("Zaloguj się")');
    
    // Should redirect to home page
    await page.waitForURL('/admin/tickets', { timeout: 10000 });
    expect(page.url()).toContain('/admin/tickets');
  });

  test('should reject login with invalid domain email', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with non-bagietka.pl email
    await page.fill('input[name="email"]', 'user@example.com');
    await page.click('button:has-text("Zaloguj się")');
    
    // Should show error message
    const errorMessage = page.getByTestId('login-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Podaj sluzbowy adres w dokladnej domenie bagietka.pl');
    
    // Should still be on login page
    expect(page.url()).toContain('/login');
  });
  
  test('should reject login with visually similar but invalid domain email', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with bagietka.com
    await page.fill('input[name="email"]', 'user@bagietka.com');
    await page.click('button:has-text("Zaloguj się")');
    
    // Should show error message
    const errorMessage = page.getByTestId('login-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Podaj sluzbowy adres w dokladnej domenie bagietka.pl');
  });

  test('should normalize email addresses', async ({ page }) => {
    await page.goto('/login');
    
    // Try with uppercase and spaces
    await page.fill('input[name="email"]', '  ADMIN@BAGIETKA.PL  ');
    await page.click('button:has-text("Zaloguj się")');
    
    // Should still work (normalize to lowercase)
    await page.waitForURL('/admin/tickets', { timeout: 10000 });
    expect(page.url()).toContain('/admin/tickets');
  });
});

test.describe('Authentication - logout', () => {
  test('should logout user and redirect to login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@bagietka.pl');
    await page.click('button:has-text("Zaloguj się")');
    await page.waitForURL('/admin/tickets');
    
    // Find and click logout button
    const logoutButton = page.getByTestId('logout-button');
    await expect(logoutButton).toBeVisible();
    
    await logoutButton.click();
    await page.waitForURL('/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});
