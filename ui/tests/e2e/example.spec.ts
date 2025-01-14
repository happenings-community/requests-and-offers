import { test, expect } from '@playwright/test';

test('should load the application', async ({ page }) => {
  await page.goto('/');
  
  // Wait for the page to be fully loaded
  await page.waitForLoadState('networkidle');
  
  // Check if the page has loaded by verifying basic HTML structure
  await expect(page.locator('html[lang="en"]')).toBeVisible();
  await expect(page.locator('body')).toBeVisible();
  
  // Take a screenshot
  await page.screenshot({ 
    path: 'test-results/example-page.png',
    fullPage: true 
  });
});
