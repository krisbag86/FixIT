import { test, expect } from '@playwright/test';
import { loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test.describe('Internal Notes - Permissions', () => {
  test('should allow AGENT to see internal note option', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto('/admin/tickets');
    
    // Click first ticket
    const firstTicket = page.getByTestId('ticket-card').first();
    await expect(firstTicket).toBeVisible();
    await firstTicket.click();
    await page.waitForURL('/admin/tickets/*');
      
    // Look for visibility select
    const visibilitySelect = page.getByTestId('visibility-select');
    await expect(visibilitySelect).toBeVisible();
    
    // Should have INTERNAL option
    const internalOption = visibilitySelect.locator('option[value="INTERNAL"]');
    await expect(internalOption).toBeAttached();
  });

  test('should allow ADMIN to see internal note option', async ({ page }) => {
    await loginAs(page, 'admin@bagietka.pl');
    await page.goto('/admin/tickets');
    
    // Click first ticket
    const firstTicket = page.getByTestId('ticket-card').first();
    await expect(firstTicket).toBeVisible();
    await firstTicket.click();
    await page.waitForURL('/admin/tickets/*');
      
    // Look for visibility select
    const visibilitySelect = page.getByTestId('visibility-select');
    await expect(visibilitySelect).toBeVisible();
    
    // Should have INTERNAL option
    const internalOption = visibilitySelect.locator('option[value="INTERNAL"]');
    await expect(internalOption).toBeAttached();
  });

  test('should NOT allow REPORTER to see internal note option', async ({ page }) => {
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await page.goto('/tickets/t_002');
    
    // Look for visibility select or ensure it's disabled
    const visibilitySelect = page.getByTestId('visibility-select');
    
    // The visibility select is rendered but might be disabled, or the internal option is missing
    await expect(visibilitySelect).toBeVisible();
    await expect(visibilitySelect).toBeDisabled();
    
    // Should NOT have INTERNAL option
    const internalOption = visibilitySelect.locator('option[value="INTERNAL"]');
    await expect(internalOption).toHaveCount(0);
  });

  test('AGENT should be able to post internal note', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto('/admin/tickets/t_001');
      
    // Add internal note
    const commentForm = page.getByTestId('comment-form');
    await expect(commentForm).toBeVisible();
    
    await commentForm.locator('textarea[name="body"]').fill('This is a secret internal note');
    await commentForm.locator('select[name="visibility"]').selectOption('INTERNAL');
    
    const submitBtn = commentForm.locator('button:has-text("Dodaj")');
    await submitBtn.click();
    
    // Note should appear
    await expect(page.locator('text="This is a secret internal note"')).toBeVisible();
    
    // And it should have internal badge
    const internalNote = page.getByTestId('comment-item').filter({ hasText: 'This is a secret internal note' });
    await expect(internalNote.getByTestId('visibility-badge')).toContainText('Wewnetrzny');
  });

  test('REPORTER should only see PUBLIC comments, not internal notes', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto('/admin/tickets/t_001');
    
    const commentForm = page.getByTestId('comment-form');
    await commentForm.locator('textarea[name="body"]').fill('SECRET_AGENT_NOTE');
    await commentForm.locator('select[name="visibility"]').selectOption('INTERNAL');
    await commentForm.locator('button:has-text("Dodaj")').click();
    
    // Verify agent sees it
    await expect(page.locator('text="SECRET_AGENT_NOTE"')).toBeVisible();
    
    // Reporter should NOT see it
    await loginAs(page, 'kasjer@bagietka.pl');
    await page.goto('/tickets/t_001');
    
    // Ensure the text is not on page
    await expect(page.locator('text="SECRET_AGENT_NOTE"')).toHaveCount(0);
  });
});
