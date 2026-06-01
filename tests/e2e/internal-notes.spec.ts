import { test, expect } from '@playwright/test';
import { loginAs, resetDatabase, createTicketViaUI } from './helpers';

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
    
    // Create a ticket first
    await createTicketViaUI(
      page,
      'Kasa / POS',
      'Test Ticket for Internal Notes',
      'This is a test description'
    );
    
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
    // First reporter creates a ticket so we have a fresh one
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await createTicketViaUI(
      page,
      'Kasa / POS',
      'Ticket for Agent Notes',
      'Testing if agent can post internal note'
    );
    
    // Get ticket URL so we know where to go back
    const ticketUrl = page.url();
    const ticketId = ticketUrl.split('/').pop();
    
    // Logout and login as agent
    const logoutBtn = page.getByTestId('logout-button');
    await logoutBtn.click();
    
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto(`/admin/tickets/${ticketId}`);
      
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
    // 1. Reporter creates ticket
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await createTicketViaUI(
      page,
      'Kasa / POS',
      'Ticket for Secret Testing',
      'Long enough body for secret testing'
    );
    const ticketUrl = page.url();
    const ticketId = ticketUrl.split('/').pop();
    
    // 2. Agent adds internal note
    await page.getByTestId('logout-button').click();
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto(`/admin/tickets/${ticketId}`);
    
    const commentForm = page.getByTestId('comment-form');
    await commentForm.locator('textarea[name="body"]').fill('SECRET_AGENT_NOTE');
    await commentForm.locator('select[name="visibility"]').selectOption('INTERNAL');
    await commentForm.locator('button:has-text("Dodaj")').click();
    
    // Verify agent sees it
    await expect(page.locator('text="SECRET_AGENT_NOTE"')).toBeVisible();
    
    // 3. Reporter should NOT see it
    await page.getByTestId('logout-button').click();
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await page.goto(`/tickets/${ticketId}`);
    
    // Ensure the text is not on page
    await expect(page.locator('text="SECRET_AGENT_NOTE"')).toHaveCount(0);
  });
});
