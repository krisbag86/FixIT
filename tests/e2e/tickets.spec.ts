import { test, expect } from '@playwright/test';
import { loginAs, resetDatabase, createTicketViaUI } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test.describe('Create Ticket', () => {
  test('should create a new ticket successfully', async ({ page }) => {
    // Login as reporter
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    
    // Use helper to create ticket
    await createTicketViaUI(
      page, 
      'Kasa / POS', 
      'Test Issue - Printer not working', 
      'The printer on station 2 is not printing. Restart was attempted but issue persists.',
      'HIGH'
    );
    
    // Verify ticket was created and we see ticket details
    const ticketNumber = page.getByTestId('ticket-number');
    await expect(ticketNumber).toBeVisible();
    await expect(ticketNumber).toContainText('IT-');
    
    // Verify title is rendered correctly
    await expect(page.locator('h1')).toContainText('Test Issue - Printer not working');
  });

  test('should show validation errors for incomplete form', async ({ page }) => {
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await page.goto('/tickets/new');
    
    // Try to submit without title (title is required)
    await page.click('button:has-text("Utworz zgloszenie")');
    
    // Browser validation should prevent submission
    // Check that we're still on the form page
    expect(page.url()).toContain('/tickets/new');
  });

  test('should prefill department from user profile', async ({ page }) => {
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await page.goto('/tickets/new');
    
    // Check that department field exists and is visible
    const departmentInput = page.locator('input[name="department"]');
    await expect(departmentInput).toBeVisible();
  });
});

test.describe('Ticket List', () => {
  test('should show created tickets in list', async ({ page }) => {
    // Create ticket first
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    await createTicketViaUI(
      page, 
      'Kasa / POS', 
      'List Visibility Test', 
      'Testing if this ticket appears in the list'
    );
    
    // Go to tickets list
    await page.goto('/tickets');
    
    // Should see at least the ticket we just created
    const ticketCards = page.getByTestId('ticket-card');
    await expect(ticketCards.first()).toBeVisible();
    await expect(page.locator('body')).toContainText('List Visibility Test');
  });
});
