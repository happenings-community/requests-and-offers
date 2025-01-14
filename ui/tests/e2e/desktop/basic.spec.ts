import { test, expect } from '@playwright/test';
import { setupDesktopTest } from '../../utils/setup-desktop';

test.describe('Basic Desktop Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupDesktopTest({ page });
  });

  test('should load the application', async ({ page }) => {
    // Navigate to the home page
    await page.goto('/');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Basic check for main content
    const mainContent = await page.locator('body');
    await expect(mainContent).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'test-results/home-page.png',
      fullPage: true
    });
  });

  test('should have correct window size', async ({ page }) => {
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(1280);
    expect(viewport?.height).toBe(720);
  });
});
