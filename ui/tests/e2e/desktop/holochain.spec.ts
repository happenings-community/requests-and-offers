import { test, expect } from '@playwright/test';
import { setupDesktopTest } from '../../utils/setup-desktop';

test.describe('Holochain Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupDesktopTest({ page });

    // Add console log capture
    page.on('console', (msg) => {
      console.log(`Page log: ${msg.text()}`);
    });

    // Add error log capture
    page.on('pageerror', (err) => {
      console.error(`Page error: ${err.message}`);
    });
  });

  test('should load users list', async ({ page }) => {
    // Navigate to users page
    await page.goto('/users');

    // Wait for table to be visible
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });

    // Check if users are displayed in the table
    const userRows = await page.locator('table tbody tr').all();
    expect(userRows.length).toBeGreaterThan(0);
  });

  test('should load organizations list', async ({ page }) => {
    // Navigate to organizations page
    await page.goto('/organizations');

    // Wait for table to be visible
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });

    // Check if organizations are displayed
    const orgRows = await page.locator('table tbody tr').all();
    expect(orgRows.length).toBeGreaterThan(0);
  });
});
