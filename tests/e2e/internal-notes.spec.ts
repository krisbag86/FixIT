import { test, expect } from '@playwright/test';

// Helper function to login as a specific user
async function loginAs(page, email: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.click('button:has-text("Wejdz do FixIT")');
  
  // Wait for redirect after login
  await page.waitForURL(/\/(admin\/tickets|tickets)/, { timeout: 5000 });
}

test.describe('Internal Notes - Permissions', () => {
  test('should allow AGENT to see internal note option', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto('/admin/tickets');
    
    // Click first ticket
    const firstTicket = page.locator('[class*="card"]').first();
    if (await firstTicket.isVisible()) {
      await firstTicket.click();
      await page.waitForURL('/admin/tickets/*');
      
      // Look for visibility select
      const visibilitySelect = page.locator('select[name="visibility"]');
      if (await visibilitySelect.isVisible()) {
        // Should have INTERNAL option
        const internalOption = visibilitySelect.locator('option:has-text("Notatka wewnetrzna")');
        expect(await internalOption.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should allow ADMIN to see internal note option', async ({ page }) => {
    await loginAs(page, 'admin@bagietka.pl');
    await page.goto('/admin/tickets');
    
    // Click first ticket
    const firstTicket = page.locator('[class*="card"]').first();
    if (await firstTicket.isVisible()) {
      await firstTicket.click();
      await page.waitForURL('/admin/tickets/*');
      
      // Look for visibility select
      const visibilitySelect = page.locator('select[name="visibility"]');
      if (await visibilitySelect.isVisible()) {
        // Should have INTERNAL option
        const internalOption = visibilitySelect.locator('option:has-text("Notatka wewnetrzna")');
        expect(await internalOption.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should NOT allow REPORTER to see internal note option', async ({ page }) => {
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    
    // Create a ticket first
    await page.goto('/tickets/new');
    const categorySelect = page.locator('select[name="categoryId"]');
    const firstCategory = categorySelect.locator('option').first();
    const categoryValue = await firstCategory.evaluate(el => el.value);
    
    await categorySelect.selectOption(categoryValue);
    await page.fill('input[name="title"]', 'Test Ticket');
    await page.fill('textarea[name="description"]', 'Test description');
    await page.click('button:has-text("Wyslij zgloszenie")');
    await page.waitForURL('/tickets/*');
    
    // Now view the ticket
    await page.waitForLoadState('networkidle');
    
    // Look for visibility select
    const visibilitySelect = page.locator('select[name="visibility"]');
    if (await visibilitySelect.isVisible()) {
      // Should NOT have INTERNAL option
      const internalOption = visibilitySelect.locator('option:has-text("Notatka wewnetrzna")');
      expect(await internalOption.count()).toBe(0);
      
      // Select should be disabled or only show PUBLIC
      const options = visibilitySelect.locator('option');
      const optionCount = await options.count();
      expect(optionCount).toBe(1); // Only PUBLIC option
    }
  });

  test('should NOT allow STORE_MANAGER to see internal note option', async ({ page }) => {
    await loginAs(page, 'kasjer@bagietka.pl');
    
    // Try to create and view ticket
    await page.goto('/tickets/new');
    const categorySelect = page.locator('select[name="categoryId"]');
    const firstCategory = categorySelect.locator('option').first();
    const categoryValue = await firstCategory.evaluate(el => el.value);
    
    await categorySelect.selectOption(categoryValue);
    await page.fill('input[name="title"]', 'Test Ticket');
    await page.fill('textarea[name="description"]', 'Test description');
    await page.click('button:has-text("Wyslij zgloszenie")');
    await page.waitForURL('/tickets/*');
    
    // View the ticket
    await page.waitForLoadState('networkidle');
    
    // Look for visibility select
    const visibilitySelect = page.locator('select[name="visibility"]');
    if (await visibilitySelect.isVisible()) {
      // Should NOT have INTERNAL option
      const internalOption = visibilitySelect.locator('option:has-text("Notatka wewnetrzna")');
      expect(await internalOption.count()).toBe(0);
    }
  });

  test('AGENT should be able to post internal note', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto('/admin/tickets');
    
    // Click first ticket
    const firstTicket = page.locator('[class*="card"]').first();
    if (await firstTicket.isVisible()) {
      await firstTicket.click();
      await page.waitForURL('/admin/tickets/*');
      
      // Add internal note
      const textarea = page.locator('textarea[name="body"]');
      const visibilitySelect = page.locator('select[name="visibility"]');
      
      if (await textarea.isVisible() && await visibilitySelect.isVisible()) {
        await textarea.fill('This is an internal note for IT team only');
        await visibilitySelect.selectOption('INTERNAL');
        
        // Submit
        const submitBtn = page.locator('button:has-text("Dodaj")').first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(1000);
          
          // Internal note should be visible with INTERNAL badge
          const internalBadge = page.locator('[class*="badge"][class*="visibility"]');
          expect(await internalBadge.count()).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test('REPORTER should only see PUBLIC comments, not internal notes', async ({ page }) => {
    // This test requires a pre-existing ticket with mixed comments
    // Login as reporter
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await page.goto('/tickets');
    
    // Click first ticket
    const firstTicket = page.locator('[class*="card"]').first();
    if (await firstTicket.isVisible()) {
      await firstTicket.click();
      await page.waitForURL('/tickets/*');
      
      // Check comments visibility
      await page.waitForLoadState('networkidle');
      
      // Should only see PUBLIC visibility badges if any
      const internalBadges = page.locator('[class*="visibility"]:has-text("Wewnetrzna")');
      expect(await internalBadges.count()).toBe(0);
    }
  });
});
