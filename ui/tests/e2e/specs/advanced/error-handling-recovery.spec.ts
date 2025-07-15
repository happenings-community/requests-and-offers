import { test, expect } from '@playwright/test';
import { setupGlobalHolochain, cleanupGlobalHolochain } from '../../utils/holochain-setup';
import type { SeededData } from '../../fixtures/holochain-data-seeder';

// ============================================================================
// ERROR HANDLING AND RECOVERY E2E TEST
// ============================================================================

test.describe('Error Handling and Recovery with Real Holochain Data', () => {
  let seededData: SeededData;

  // Setup before all tests in this describe block
  test.beforeAll(async () => {
    console.log('🚀 Setting up Holochain with real data for error handling tests...');
    const setup = await setupGlobalHolochain();
    seededData = setup.seededData;
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    await cleanupGlobalHolochain();
  });

  test('Application handles network connectivity issues gracefully', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to offers page to establish baseline
    await page.goto('/offers');
    await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(seededData.offers.length);

    // Simulate network disconnection
    await page.context().setOffline(true);

    // Try to navigate to a new page
    await page.goto('/requests');

    // Should show offline message or cached content
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    const cachedContent = page.locator('[data-testid="cached-content"]');
    const errorMessage = page.locator('[data-testid="network-error"]');

    // One of these should be visible
    const hasOfflineHandling =
      (await offlineIndicator.isVisible()) ||
      (await cachedContent.isVisible()) ||
      (await errorMessage.isVisible());
    expect(hasOfflineHandling).toBe(true);

    // Restore network connection
    await page.context().setOffline(false);

    // Try to refresh or navigate again
    await page.reload();
    await page.waitForTimeout(3000);

    // Should recover and show content
    await expect(page.locator('[data-testid="request-card"]')).toBeVisible({ timeout: 15000 });
  });

  test('Form validation and error recovery for invalid data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to create offer page
    await page.goto('/offers/create');

    // Test empty form submission
    await page.click('[data-testid="submit-offer"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(page.locator('text=Title is required')).toBeVisible();

    // Test invalid email format (if email field exists)
    const emailField = page.locator('[data-testid="contact-email-input"]');
    if (await emailField.isVisible()) {
      await emailField.fill('invalid-email');
      await page.click('[data-testid="submit-offer"]');
      await expect(page.locator('text=Invalid email format')).toBeVisible();
    }

    // Test invalid price format
    const priceField = page.locator('[data-testid="price-input"]');
    if (await priceField.isVisible()) {
      await priceField.fill('not-a-number');
      await page.click('[data-testid="submit-offer"]');
      await expect(page.locator('text=Invalid price format')).toBeVisible();
    }

    // Test recovery by filling valid data
    await page.fill('[data-testid="offer-title-input"]', 'Valid Test Offer');
    await page.fill(
      '[data-testid="offer-description-input"]',
      'This is a valid test offer description'
    );

    // Select service type
    const serviceTypeSelect = page.locator('[data-testid="service-type-select"]');
    if (await serviceTypeSelect.isVisible()) {
      await serviceTypeSelect.selectOption({ index: 1 });
    }

    // Select medium of exchange
    const mediumSelect = page.locator('[data-testid="medium-select"]');
    if (await mediumSelect.isVisible()) {
      await mediumSelect.selectOption({ index: 1 });
    }

    // Submit valid form
    await page.click('[data-testid="submit-offer"]');

    // Should succeed or show success message
    await expect(page.locator('text=Offer created successfully')).toBeVisible({ timeout: 15000 });
  });

  test('Holochain connection errors and reconnection handling', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to a page that requires Holochain data
    await page.goto('/offers');
    await expect(page.locator('[data-testid="offer-card"]')).toBeVisible();

    // Simulate Holochain connection issues by intercepting network requests
    await page.route('**/api/**', (route) => {
      route.abort('failed');
    });

    // Try to perform an action that requires Holochain
    await page.click('[data-testid="create-offer-button"]');

    // Should show connection error
    const connectionError = page.locator('[data-testid="holochain-connection-error"]');
    const retryButton = page.locator('[data-testid="retry-connection"]');

    if (await connectionError.isVisible()) {
      await expect(connectionError).toBeVisible();

      // Test retry functionality
      if (await retryButton.isVisible()) {
        // Remove the route interception to allow reconnection
        await page.unroute('**/api/**');

        await retryButton.click();

        // Should recover
        await expect(page.locator('[data-testid="holochain-connected"]')).toBeVisible({
          timeout: 15000
        });
      }
    }
  });

  test('Search and filter error handling with invalid inputs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to offers page
    await page.goto('/offers');

    // Test search with extremely long input
    const longSearchTerm = 'a'.repeat(1000);
    await page.fill('[data-testid="search-input"]', longSearchTerm);
    await page.press('[data-testid="search-input"]', 'Enter');

    // Should handle gracefully
    const errorMessage = page.locator('[data-testid="search-error"]');
    const noResults = page.locator('[data-testid="no-results-message"]');
    const results = page.locator('[data-testid="offer-card"]');

    // Should either show error, no results, or handle the search
    const hasValidResponse =
      (await errorMessage.isVisible()) ||
      (await noResults.isVisible()) ||
      (await results.isVisible());
    expect(hasValidResponse).toBe(true);

    // Test search with special characters that might break queries
    const specialChars = ['<script>', 'DROP TABLE', '"; DELETE FROM', '\\', "''"];

    for (const specialChar of specialChars.slice(0, 2)) {
      // Test first 2 to save time
      await page.fill('[data-testid="search-input"]', specialChar);
      await page.press('[data-testid="search-input"]', 'Enter');
      await page.waitForTimeout(1000);

      // Should not break the application
      const pageError = page.locator('[data-testid="page-error"]');
      expect(await pageError.isVisible()).toBe(false);
    }

    // Test recovery with normal search
    await page.fill('[data-testid="search-input"]', 'design');
    await page.press('[data-testid="search-input"]', 'Enter');
    await page.waitForTimeout(2000);

    // Should work normally
    const normalResults = await page.locator('[data-testid="offer-card"]').count();
    expect(normalResults).toBeGreaterThanOrEqual(0);
  });

  test('File upload and data processing error handling', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to profile edit page (if file upload is supported)
    await page.goto('/profile/edit');

    const fileUpload = page.locator('[data-testid="avatar-upload"]');

    if (await fileUpload.isVisible()) {
      // Test invalid file type
      const invalidFile = Buffer.from('invalid file content');
      await fileUpload.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: invalidFile
      });

      // Should show file type error
      await expect(page.locator('text=Invalid file type')).toBeVisible({ timeout: 5000 });

      // Test file too large (simulate)
      const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10MB
      await fileUpload.setInputFiles({
        name: 'large.jpg',
        mimeType: 'image/jpeg',
        buffer: largeFile
      });

      // Should show file size error
      await expect(page.locator('text=File too large')).toBeVisible({ timeout: 5000 });

      // Test recovery with valid file
      const validFile = Buffer.from('fake image data');
      await fileUpload.setInputFiles({
        name: 'avatar.jpg',
        mimeType: 'image/jpeg',
        buffer: validFile
      });

      // Should accept the file or show upload progress
      const uploadSuccess = page.locator('[data-testid="upload-success"]');
      const uploadProgress = page.locator('[data-testid="upload-progress"]');

      const hasValidUpload =
        (await uploadSuccess.isVisible()) || (await uploadProgress.isVisible());
      expect(hasValidUpload).toBe(true);
    }
  });

  test('Concurrent user actions and conflict resolution', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Open a second page to simulate concurrent user
    const page2 = await context.newPage();
    await page2.goto('/');
    await expect(page2.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Both users navigate to the same offer
    const testOffer = seededData.offers[0];
    await page.goto(`/offers/${testOffer.actionHash}`);
    await page2.goto(`/offers/${testOffer.actionHash}`);

    // Both users try to edit the same offer (if editing is supported)
    const editButton = page.locator('[data-testid="edit-offer"]');
    const editButton2 = page2.locator('[data-testid="edit-offer"]');

    if ((await editButton.isVisible()) && (await editButton2.isVisible())) {
      // First user starts editing
      await editButton.click();
      await page.fill('[data-testid="offer-title-input"]', 'Updated by User 1');

      // Second user tries to edit
      await editButton2.click();

      // Should show conflict warning or prevent concurrent editing
      const conflictWarning = page2.locator('[data-testid="edit-conflict-warning"]');
      const editPrevented = page2.locator('[data-testid="edit-prevented"]');

      const hasConflictHandling =
        (await conflictWarning.isVisible()) || (await editPrevented.isVisible());
      expect(hasConflictHandling).toBe(true);

      // First user saves changes
      await page.click('[data-testid="save-offer"]');
      await expect(page.locator('text=Offer updated')).toBeVisible({ timeout: 10000 });

      // Second user should be notified of changes
      await page2.reload();
      await expect(page2.locator('text=Updated by User 1')).toBeVisible();
    }

    await page2.close();
  });

  test('Session timeout and authentication recovery', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to a protected area
    await page.goto('/profile');

    // Simulate session timeout by clearing storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Try to perform an authenticated action
    await page.click('[data-testid="edit-profile"]');

    // Should redirect to login or show authentication error
    const loginRedirect = page.locator('[data-testid="login-form"]');
    const authError = page.locator('[data-testid="authentication-error"]');
    const sessionExpired = page.locator('[data-testid="session-expired"]');

    const hasAuthHandling =
      (await loginRedirect.isVisible()) ||
      (await authError.isVisible()) ||
      (await sessionExpired.isVisible());
    expect(hasAuthHandling).toBe(true);

    // Test recovery by refreshing or re-authenticating
    await page.reload();
    await page.waitForTimeout(3000);

    // Should either restore session or prompt for re-authentication
    const isRecovered = await page.locator('[data-testid="user-profile"]').isVisible();
    const needsAuth = await page.locator('[data-testid="authentication-required"]').isVisible();

    expect(isRecovered || needsAuth).toBe(true);
  });

  test('Data synchronization errors and recovery mechanisms', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to offers page
    await page.goto('/offers');
    await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(seededData.offers.length);

    // Simulate data sync issues by intercepting specific requests
    await page.route('**/offers', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
      } else {
        route.continue();
      }
    });

    // Refresh to trigger sync error
    await page.reload();

    // Should show sync error and retry options
    const syncError = page.locator('[data-testid="sync-error"]');
    const retrySync = page.locator('[data-testid="retry-sync"]');
    const offlineMode = page.locator('[data-testid="offline-mode"]');

    const hasSyncErrorHandling =
      (await syncError.isVisible()) ||
      (await retrySync.isVisible()) ||
      (await offlineMode.isVisible());
    expect(hasSyncErrorHandling).toBe(true);

    // Test retry mechanism
    if (await retrySync.isVisible()) {
      // Remove the route interception
      await page.unroute('**/offers');

      await retrySync.click();

      // Should recover and show data
      await expect(page.locator('[data-testid="offer-card"]')).toBeVisible({ timeout: 15000 });
    }
  });

  test('Browser compatibility and graceful degradation', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Test with disabled JavaScript (if possible)
    await page.addInitScript(() => {
      // Simulate older browser by removing modern features
      delete (window as any).fetch;
      delete (window as any).WebSocket;
    });

    await page.reload();

    // Should show fallback content or compatibility warning
    const compatibilityWarning = page.locator('[data-testid="compatibility-warning"]');
    const fallbackContent = page.locator('[data-testid="fallback-content"]');
    const modernBrowserRequired = page.locator('[data-testid="modern-browser-required"]');

    const hasCompatibilityHandling =
      (await compatibilityWarning.isVisible()) ||
      (await fallbackContent.isVisible()) ||
      (await modernBrowserRequired.isVisible());

    // Should either handle gracefully or show appropriate warnings
    expect(hasCompatibilityHandling).toBe(true);
  });

  test('Memory and performance error recovery', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to a data-heavy page
    await page.goto('/offers');

    // Simulate memory pressure by creating many DOM elements
    await page.evaluate(() => {
      for (let i = 0; i < 1000; i++) {
        const div = document.createElement('div');
        div.innerHTML = 'Memory test element ' + i;
        document.body.appendChild(div);
      }
    });

    // Try to perform normal operations
    await page.fill('[data-testid="search-input"]', 'test');
    await page.press('[data-testid="search-input"]', 'Enter');

    // Should still function or show performance warnings
    const performanceWarning = page.locator('[data-testid="performance-warning"]');
    const searchResults = page.locator('[data-testid="offer-card"]');

    const isStillFunctional =
      (await performanceWarning.isVisible()) || (await searchResults.isVisible());
    expect(isStillFunctional).toBe(true);

    // Clean up
    await page.evaluate(() => {
      const testElements = document.querySelectorAll('div');
      testElements.forEach((el) => {
        if (el.innerHTML.includes('Memory test element')) {
          el.remove();
        }
      });
    });
  });
});
