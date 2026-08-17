import { test, expect } from '@playwright/test';
import { resetDatabase, submitLogin } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test.describe('Authentication - bagietka.pl domain', () => {
  test('should allow login with valid bagietka.pl email', async ({ page }) => {
    await page.goto('/login');
    
    // Check page loads
    expect(await page.getByTestId('login-form').isVisible()).toBeTruthy();
    
    // Fill form with valid email
    await submitLogin(page, 'admin@bagietka.pl');
    
    // Should redirect to home page
    await page.waitForURL('/admin/dashboard', { timeout: 30000 });
    expect(page.url()).toContain('/admin/dashboard');
  });

  test('should reject login with invalid domain email', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with non-bagietka.pl email
    await submitLogin(page, 'user@example.com');
    
    // Should show error message
    const errorMessage = page.getByTestId('login-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Podaj służbowy adres w domenie bagietka.pl');
    
    // Should still be on login page
    expect(page.url()).toContain('/login');
  });
  
  test('should reject login with visually similar but invalid domain email', async ({ page }) => {
    await page.goto('/login');
    
    // Try to login with bagietka.com
    await submitLogin(page, 'user@bagietka.com');
    
    // Should show error message
    const errorMessage = page.getByTestId('login-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Podaj służbowy adres w domenie bagietka.pl');
  });

  test('should normalize email addresses', async ({ page }) => {
    await page.goto('/login');
    
    // Try with uppercase and spaces
    await submitLogin(page, '  ADMIN@BAGIETKA.PL  ');
    
    // Should still work (normalize to lowercase)
    await page.waitForURL('/admin/dashboard', { timeout: 30000 });
    expect(page.url()).toContain('/admin/dashboard');
  });
});

test.describe('Authentication - logout', () => {
  test('should logout user and redirect to login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await submitLogin(page, 'admin@bagietka.pl');
    await page.waitForURL('/admin/dashboard', { timeout: 30000 });
    
    // Find and click logout button
    const logoutButton = page.getByTestId('logout-button');
    await expect(logoutButton).toBeVisible();
    
    await logoutButton.click();
    await page.waitForURL('/login', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});
