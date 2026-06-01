import { test, expect } from '@playwright/test';
import { loginAs, resetDatabase } from './helpers';

test.beforeEach(() => {
  resetDatabase();
});

test.describe('Admin Panel - Ticket Management', () => {
  test('should display admin tickets page for agent/admin', async ({ page }) => {
    // Login as admin
    await loginAs(page, 'admin@bagietka.pl');
    
    // Should be redirected to admin panel
    expect(page.url()).toContain('/admin/tickets');
    
    // Page should have queue title
    await expect(page.locator('h1')).toContainText('Kolejka zgloszen');
  });

  test('should allow agent to view ticket details', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    
    // We assume seed data creates at least one ticket
    const firstTicket = page.getByTestId('ticket-card').first();
    await expect(firstTicket).toBeVisible();
    
    await firstTicket.click();
      
    // Should navigate to ticket detail
    await page.waitForURL('/admin/tickets/*', { timeout: 10000 });
    
    // Verify admin actions are visible
    const adminActions = page.getByTestId('admin-actions');
    await expect(adminActions).toBeVisible();
  });

  test('should allow agent to assign ticket', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto('/admin/tickets');
    
    // Click first ticket
    const firstTicket = page.getByTestId('ticket-card').first();
    await expect(firstTicket).toBeVisible();
    await firstTicket.click();
    await page.waitForURL('/admin/tickets/*');
      
    // Assign to agent
    const adminActions = page.getByTestId('admin-actions');
    await expect(adminActions).toBeVisible();
    
    const assigneeSelect = adminActions.locator('select[name="assigneeId"]');
    await expect(assigneeSelect).toBeVisible();
    
    // Select Marek Agent (seed user)
    await assigneeSelect.selectOption({ label: 'Marek Agent' });
    
    const saveBtn = adminActions.locator('button:has-text("Zapisz zmiany")');
    await saveBtn.click();
    
    // Wait for reload (which is fast, so we just wait for network idle)
    await page.waitForLoadState('networkidle');
    
    // Check if assignee is updated in info panel
    await expect(page.locator('body')).toContainText('Marek Agent');
  });

  test('should allow agent to change ticket status', async ({ page }) => {
    await loginAs(page, 'agent@bagietka.pl');
    await page.goto('/admin/tickets');
    
    // Click first ticket
    const firstTicket = page.getByTestId('ticket-card').first();
    await expect(firstTicket).toBeVisible();
    await firstTicket.click();
    await page.waitForURL('/admin/tickets/*');
      
    const adminActions = page.getByTestId('admin-actions');
    const statusSelect = adminActions.locator('select[name="status"]');
    await expect(statusSelect).toBeVisible();
    
    // Change status to IN_PROGRESS
    await statusSelect.selectOption('IN_PROGRESS');
    
    const saveBtn = adminActions.locator('button:has-text("Zapisz zmiany")');
    await saveBtn.click();
    
    // Status badge should reflect it
    await expect(page.locator('body')).toContainText('W trakcie');
  });

  test('reporter should NOT see admin tickets panel', async ({ page }) => {
    // Login as reporter (store manager)
    await loginAs(page, 'sklep.waw01@bagietka.pl');
    
    // Should be redirected to user tickets, not admin
    expect(page.url()).toContain('/tickets');
    expect(page.url()).not.toContain('/admin');
    
    // Try to force access
    await page.goto('/admin/tickets');
    // Should be redirected
    expect(page.url()).not.toContain('/admin/tickets');
  });
});
