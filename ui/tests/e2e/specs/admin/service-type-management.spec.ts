import { test, expect } from '@playwright/test';
import { setupGlobalHolochain, cleanupGlobalHolochain } from '../../utils/holochain-setup';
import type { SeededData } from '../../fixtures/holochain-data-seeder';

// ============================================================================
// SERVICE TYPE MANAGEMENT E2E TEST
// ============================================================================

test.describe('Service Type Management with Real Holochain Data', () => {
  let seededData: SeededData;

  // Setup before all tests in this describe block
  test.beforeAll(async () => {
    console.log('🚀 Setting up Holochain with real data for service type management tests...');
    const setup = await setupGlobalHolochain();
    seededData = setup.seededData;
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    await cleanupGlobalHolochain();
  });

  test('Admin can view all service types with real seeded data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin service types page
    await page.goto('/admin/service-types');
    await expect(page).toHaveURL('/admin/service-types');

    // Verify that seeded service types are displayed
    await expect(page.locator('[data-testid="service-type-card"]')).toHaveCount(
      seededData.serviceTypes.length,
      { timeout: 15000 }
    );

    // Verify first service type displays correct information
    const firstServiceType = seededData.serviceTypes[0];
    await expect(page.locator(`text=${firstServiceType.data.name}`)).toBeVisible();
    
    if (firstServiceType.data.description) {
      await expect(page.locator(`text=${firstServiceType.data.description}`)).toBeVisible();
    }

    // Verify service type status indicators
    await expect(page.locator('[data-testid="service-type-status"]')).toBeVisible();
  });

  test('Admin can create a new service type', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin service types page
    await page.goto('/admin/service-types');

    // Click create service type button
    await page.click('[data-testid="create-service-type-button"]');

    // Fill in service type details
    await page.fill('[data-testid="service-type-name-input"]', 'E2E Test Service Type');
    await page.fill('[data-testid="service-type-description-input"]', 'This is a test service type created during E2E testing');
    
    // Add tags
    await page.fill('[data-testid="service-type-tags-input"]', 'testing, e2e, automation');
    
    // Set category or parent service type if applicable
    const categorySelect = page.locator('[data-testid="service-type-category-select"]');
    if (await categorySelect.isVisible()) {
      await categorySelect.selectOption('Technology');
    }

    // Submit service type creation
    await page.click('[data-testid="submit-service-type"]');

    // Wait for creation to complete
    await expect(page.locator('text=Service type created successfully')).toBeVisible({ timeout: 15000 });

    // Verify the new service type appears in the list
    await expect(page.locator('text=E2E Test Service Type')).toBeVisible();
  });

  test('Admin can edit existing service type', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin service types page
    await page.goto('/admin/service-types');

    // Use a seeded service type for editing
    const testServiceType = seededData.serviceTypes[0];
    
    // Click edit button for the first service type
    await page.click(`[data-testid="edit-service-type-${testServiceType.actionHash}"]`);

    // Modify service type details
    const updatedDescription = `${testServiceType.data.description} - Updated during E2E testing`;
    await page.fill('[data-testid="service-type-description-input"]', updatedDescription);
    
    // Add additional tags
    const currentTags = testServiceType.data.tags?.join(', ') || '';
    await page.fill('[data-testid="service-type-tags-input"]', `${currentTags}, e2e-updated`);

    // Submit changes
    await page.click('[data-testid="save-service-type"]');

    // Wait for update to complete
    await expect(page.locator('text=Service type updated successfully')).toBeVisible({ timeout: 15000 });

    // Verify changes are reflected
    await expect(page.locator(`text=${updatedDescription}`)).toBeVisible();
  });

  test('Admin can approve pending service types', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin service types page
    await page.goto('/admin/service-types');

    // Check for pending service types
    const pendingSection = page.locator('[data-testid="pending-service-types"]');
    
    if (await pendingSection.isVisible()) {
      // Click on first pending service type
      await page.click('[data-testid="pending-service-type"]:first-child');
      
      // Review service type details
      await expect(page.locator('[data-testid="service-type-review"]')).toBeVisible();
      
      // Approve the service type
      await page.click('[data-testid="approve-service-type"]');
      
      // Confirm approval
      await page.click('[data-testid="confirm-approval"]');
      
      // Wait for approval to complete
      await expect(page.locator('text=Service type approved successfully')).toBeVisible({ timeout: 15000 });
    } else {
      // No pending service types - this is also a valid state
      await expect(page.locator('[data-testid="no-pending-service-types"]')).toBeVisible();
    }
  });

  test('Admin can reject pending service types with reason', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin service types page
    await page.goto('/admin/service-types');

    // Check for pending service types
    const pendingSection = page.locator('[data-testid="pending-service-types"]');
    
    if (await pendingSection.isVisible()) {
      // Click on first pending service type
      await page.click('[data-testid="pending-service-type"]:first-child');
      
      // Review service type details
      await expect(page.locator('[data-testid="service-type-review"]')).toBeVisible();
      
      // Reject the service type
      await page.click('[data-testid="reject-service-type"]');
      
      // Provide rejection reason
      await page.fill('[data-testid="rejection-reason"]', 'This service type is too broad and needs more specific categorization.');
      
      // Confirm rejection
      await page.click('[data-testid="confirm-rejection"]');
      
      // Wait for rejection to complete
      await expect(page.locator('text=Service type rejected')).toBeVisible({ timeout: 15000 });
    }
  });

  test('Admin can manage service type categories and hierarchy', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin service types page
    await page.goto('/admin/service-types');

    // Check category management section
    await page.click('[data-testid="manage-categories-button"]');
    
    // Verify category management interface
    await expect(page.locator('[data-testid="category-management"]')).toBeVisible();
    
    // Test creating a new category
    await page.click('[data-testid="create-category-button"]');
    await page.fill('[data-testid="category-name-input"]', 'E2E Test Category');
    await page.fill('[data-testid="category-description-input"]', 'Test category for E2E testing');
    
    // Submit category creation
    await page.click('[data-testid="submit-category"]');
    
    // Wait for creation to complete
    await expect(page.locator('text=Category created successfully')).toBeVisible({ timeout: 15000 });
    
    // Verify new category appears
    await expect(page.locator('text=E2E Test Category')).toBeVisible();
  });

  test('Admin can view service type usage statistics', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin service types page
    await page.goto('/admin/service-types');

    // Click on a service type to view details
    const firstServiceType = seededData.serviceTypes[0];
    await page.click(`text=${firstServiceType.data.name}`);

    // Verify service type details page
    await expect(page.locator('[data-testid="service-type-details"]')).toBeVisible();
    
    // Check usage statistics section
    await expect(page.locator('[data-testid="usage-statistics"]')).toBeVisible();
    
    // Verify statistics are displayed
    await expect(page.locator('[data-testid="offers-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="requests-count"]')).toBeVisible();
    
    // Check related offers and requests
    const relatedOffers = seededData.offers.filter(offer => 
      offer.serviceTypeHashes.includes(firstServiceType.actionHash)
    );
    
    const relatedRequests = seededData.requests.filter(request => 
      request.serviceTypeHashes.includes(firstServiceType.actionHash)
    );
    
    // Verify counts match the actual data
    if (relatedOffers.length > 0) {
      await expect(page.locator(`text=${relatedOffers.length} offers`)).toBeVisible();
    }
    
    if (relatedRequests.length > 0) {
      await expect(page.locator(`text=${relatedRequests.length} requests`)).toBeVisible();
    }
  });

  test('Admin can bulk manage service types', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin service types page
    await page.goto('/admin/service-types');

    // Enable bulk selection mode
    await page.click('[data-testid="bulk-actions-toggle"]');
    
    // Select multiple service types
    await page.check('[data-testid="select-service-type"]:nth-child(1)');
    await page.check('[data-testid="select-service-type"]:nth-child(2)');
    
    // Verify bulk actions are available
    await expect(page.locator('[data-testid="bulk-actions-menu"]')).toBeVisible();
    
    // Test bulk status change
    await page.click('[data-testid="bulk-status-change"]');
    await page.selectOption('[data-testid="status-select"]', 'active');
    
    // Confirm bulk action
    await page.click('[data-testid="confirm-bulk-action"]');
    
    // Wait for bulk action to complete
    await expect(page.locator('text=Bulk action completed')).toBeVisible({ timeout: 15000 });
  });
});
