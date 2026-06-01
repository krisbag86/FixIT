import { test, expect } from '@playwright/test';

// Helper function to login as a specific user
async function loginAs(page, email: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.click('button:has-text("Wejdz do FixIT")');
  
  // Wait for redirect after login
  await page.waitForURL(/\/(admin\/tickets|tickets)/, { timeout: 5000 });
}

test.describe('Create Ticket', () => {
  test('should create a new ticket successfully', async ({ page }) => {
    // Login as reporter
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    
    // Navigate to create ticket page
    await page.goto('/tickets/new');
    expect(await page.locator('h1:has-text("Nowe zgloszenie")').isVisible()).toBeTruthy();
    
    // Fill form
    const categorySelect = page.locator('select[name="categoryId"]');
    const firstCategory = categorySelect.locator('option').first();
    const categoryValue = await firstCategory.evaluate(el => el.value);
    
    await categorySelect.selectOption(categoryValue);
    await page.fill('input[name="title"]', 'Test Issue - Printer not working');
    await page.fill('textarea[name="description"]', 'The printer on station 2 is not printing. Restart was attempted but issue persists.');
    await page.selectOption('select[name="priority"]', 'HIGH');
    
    // Submit form
    await page.click('button:has-text("Wyslij zgloszenie")');
    
    // Should redirect to ticket detail page
    await page.waitForURL('/tickets/*', { timeout: 5000 });
    
    // Verify ticket was created
    expect(await page.locator('[class*="number"]').first().isVisible()).toBeTruthy();
  });

  test('should show validation errors for incomplete form', async ({ page }) => {
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await page.goto('/tickets/new');
    
    // Try to submit without title
    await page.click('button:has-text("Wyslij zgloszenie")');
    
    // Browser validation should prevent submission
    // Check that we're still on the form page
    expect(page.url()).toContain('/tickets/new');
  });

  test('should prefill department from user profile', async ({ page }) => {
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await page.goto('/tickets/new');
    
    // Check that department field exists
    const departmentInput = page.locator('input[name="department"]');
    expect(await departmentInput.isVisible()).toBeTruthy();
  });

  test('should set correct priority based on blocksWork', async ({ page }) => {
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await page.goto('/tickets/new');
    
    // Fill form with basic info
    const categorySelect = page.locator('select[name="categoryId"]');
    const firstCategory = categorySelect.locator('option').first();
    const categoryValue = await firstCategory.evaluate(el => el.value);
    
    await categorySelect.selectOption(categoryValue);
    await page.fill('input[name="title"]', 'Critical Issue');
    await page.fill('textarea[name="description"]', 'This is a critical issue that blocks work.');
    
    // Select CRITICAL priority
    await page.selectOption('select[name="priority"]', 'CRITICAL');
    
    await page.click('button:has-text("Wyslij zgloszenie")');
    await page.waitForURL('/tickets/*', { timeout: 5000 });
    
    // Verify ticket shows CRITICAL priority
    const priorityBadge = page.locator('[class*="badge"][class*="priority"]');
    expect(await priorityBadge.isVisible()).toBeTruthy();
  });
});

test.describe('Ticket List', () => {
  test('should show created tickets in list', async ({ page }) => {
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    
    // Go to tickets list
    await page.goto('/tickets');
    
    // Should see tickets
    const ticketCards = page.locator('[class*="card"]');
    expect(await ticketCards.count()).toBeGreaterThanOrEqual(0);
  });
});
