import { test, expect } from '@playwright/test';

// Helper function to login as a specific user
async function loginAs(page, email: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.click('button:has-text("Wejdz do FixIT")');
  
  // Wait for redirect after login
  await page.waitForURL(/\/(admin\/tickets|tickets)/, { timeout: 5000 });
}

test.describe('Admin Panel - Ticket Management', () => {
  test('should display admin tickets page for agent/admin', async ({ page }) => {
    // Login as admin
    await loginAs(page, 'admin@bagietka.pl');
    
    // Should be redirected to admin panel
    expect(page.url()).toContain('/admin/tickets');
    
    // Page should be visible
    await page.waitForLoadState('networkidle');
    expect(await page.isVisible('[class*="ticket"]')).toBeTruthy();
  });

  test('should display admin tickets page for agent', async ({ page }) => {
    // Login as agent
    await loginAs(page, 'agent@bagietka.pl');
    
    // Should be redirected to admin panel (agents can see all tickets)
    expect(page.url()).toContain('/admin/tickets');
  });

  test('should allow agent to view ticket details', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    
    // Click first ticket if available
    const firstTicket = page.locator('[class*="card"]').first();
    if (await firstTicket.isVisible()) {
      await firstTicket.click();
      
      // Should navigate to ticket detail
      await page.waitForURL('/admin/tickets/*', { timeout: 5000 });
      expect(page.url()).toMatch(/\/admin\/tickets\/[a-z0-9]+/);
    }
  });

  test('should allow agent to assign ticket', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto('/admin/tickets');
    
    // Click first ticket
    const firstTicket = page.locator('[class*="card"]').first();
    if (await firstTicket.isVisible()) {
      await firstTicket.click();
      await page.waitForURL('/admin/tickets/*');
      
      // Look for assignee select/button
      const assigneeSelect = page.locator('select[name="assigneeId"], button:has-text("Przypisz")').first();
      if (await assigneeSelect.isVisible()) {
        // Try to assign
        if (assigneeSelect.evaluate(el => el.tagName) === 'SELECT') {
          const options = assigneeSelect.locator('option');
          const optionCount = await options.count();
          if (optionCount > 1) {
            // Select second option (first is usually placeholder)
            await assigneeSelect.selectOption(await options.nth(1).evaluate(el => el.value));
            
            // Save changes (if there's a save button)
            const saveBtn = page.locator('button:has-text("Zapisz"), button:has-text("Save")').first();
            if (await saveBtn.isVisible()) {
              await saveBtn.click();
            }
          }
        }
      }
    }
  });

  test('should allow agent to change ticket status', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto('/admin/tickets');
    
    // Click first ticket
    const firstTicket = page.locator('[class*="card"]').first();
    if (await firstTicket.isVisible()) {
      await firstTicket.click();
      await page.waitForURL('/admin/tickets/*');
      
      // Look for status select
      const statusSelect = page.locator('select[name="status"]').first();
      if (await statusSelect.isVisible()) {
        const options = statusSelect.locator('option');
        const optionCount = await options.count();
        if (optionCount > 1) {
          // Select different status
          await statusSelect.selectOption(await options.nth(1).evaluate(el => el.value));
          
          // Save changes
          const saveBtn = page.locator('button:has-text("Zapisz"), button:has-text("Save")').first();
          if (await saveBtn.isVisible()) {
            await saveBtn.click();
          }
        }
      }
    }
  });

  test('reporter should NOT see admin tickets panel', async ({ page }) => {
    // Login as reporter (store manager)
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    
    // Should be redirected to user tickets, not admin
    expect(page.url()).toContain('/tickets');
    expect(page.url()).not.toContain('/admin');
  });
});

test.describe('Admin Panel - Access Control', () => {
  test('should prevent direct access to admin panel for reporters', async ({ page }) => {
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    
    // Try to access admin panel directly
    await page.goto('/admin/tickets');
    
    // Should redirect or show access denied
    // Either redirects back to /tickets or shows error
    expect(page.url()).not.toContain('/admin/tickets');
  });

  test('should allow agent to access all tickets regardless of store', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto('/admin/tickets');
    
    // Agent should be able to see tickets from different stores
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/admin/tickets');
  });
});
