import { test, expect } from '@playwright/test';
import { setupGlobalHolochain, cleanupGlobalHolochain } from '../../utils/holochain-setup';
import type { SeededData } from '../../fixtures/holochain-data-seeder';

// ============================================================================
// MEDIUM OF EXCHANGE MANAGEMENT E2E TEST
// ============================================================================

test.describe('Medium of Exchange Management with Real Holochain Data', () => {
  let seededData: SeededData;

  // Setup before all tests in this describe block
  test.beforeAll(async () => {
    console.log('🚀 Setting up Holochain with real data for medium of exchange management tests...');
    const setup = await setupGlobalHolochain();
    seededData = setup.seededData;
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    await cleanupGlobalHolochain();
  });

  test('Admin can view all mediums of exchange with real seeded data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin mediums of exchange page
    await page.goto('/admin/mediums-of-exchange');
    await expect(page).toHaveURL('/admin/mediums-of-exchange');

    // Verify that seeded mediums of exchange are displayed
    await expect(page.locator('[data-testid="medium-card"]')).toHaveCount(
      seededData.mediumsOfExchange.length,
      { timeout: 15000 }
    );

    // Verify first medium displays correct information
    const firstMedium = seededData.mediumsOfExchange[0];
    await expect(page.locator(`text=${firstMedium.data.name}`)).toBeVisible();
    
    if (firstMedium.data.code) {
      await expect(page.locator(`text=${firstMedium.data.code}`)).toBeVisible();
    }

    // Verify medium type and status indicators
    await expect(page.locator('[data-testid="medium-type"]')).toBeVisible();
    await expect(page.locator('[data-testid="medium-status"]')).toBeVisible();
  });

  test('Admin can create a new medium of exchange', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin mediums of exchange page
    await page.goto('/admin/mediums-of-exchange');

    // Click create medium button
    await page.click('[data-testid="create-medium-button"]');

    // Fill in medium details
    await page.fill('[data-testid="medium-name-input"]', 'E2E Test Cryptocurrency');
    await page.fill('[data-testid="medium-description-input"]', 'This is a test cryptocurrency created during E2E testing');
    
    // Select medium type
    await page.selectOption('[data-testid="medium-type-select"]', 'cryptocurrency');
    
    // Set currency code if applicable
    await page.fill('[data-testid="currency-code-input"]', 'E2E');
    
    // Set exchange rate or value
    await page.fill('[data-testid="exchange-rate-input"]', '1.0');
    
    // Add additional properties
    await page.fill('[data-testid="medium-symbol-input"]', 'Ξ2Ξ');

    // Submit medium creation
    await page.click('[data-testid="submit-medium"]');

    // Wait for creation to complete
    await expect(page.locator('text=Medium of exchange created successfully')).toBeVisible({ timeout: 15000 });

    // Verify the new medium appears in the list
    await expect(page.locator('text=E2E Test Cryptocurrency')).toBeVisible();
  });

  test('Admin can edit existing medium of exchange', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin mediums of exchange page
    await page.goto('/admin/mediums-of-exchange');

    // Use a seeded medium for editing
    const testMedium = seededData.mediumsOfExchange[0];
    
    // Click edit button for the first medium
    await page.click(`[data-testid="edit-medium-${testMedium.actionHash}"]`);

    // Modify medium details
    const updatedName = `${testMedium.data.name} - Updated during E2E testing`;
    await page.fill('[data-testid="medium-name-input"]', updatedName);
    
    // Update exchange rate if applicable
    await page.fill('[data-testid="exchange-rate-input"]', '1.05');

    // Submit changes
    await page.click('[data-testid="save-medium"]');

    // Wait for update to complete
    await expect(page.locator('text=Medium of exchange updated successfully')).toBeVisible({ timeout: 15000 });

    // Verify changes are reflected
    await expect(page.locator(`text=${updatedDescription}`)).toBeVisible();
  });

  test('Admin can manage medium categories and types', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin mediums of exchange page
    await page.goto('/admin/mediums-of-exchange');

    // Test filtering by medium type
    await page.selectOption('[data-testid="medium-type-filter"]', 'currency');
    
    // Verify filtered results
    const currencyMediums = seededData.mediumsOfExchange.filter(medium => 
      medium.data.code.includes('CURR') || medium.data.name.toLowerCase().includes('currency')
    );
    
    if (currencyMediums.length > 0) {
      await expect(page.locator('[data-testid="medium-card"]')).toHaveCount(currencyMediums.length);
    }

    // Test alternative exchange types
    await page.selectOption('[data-testid="medium-type-filter"]', 'skill_exchange');
    
    const skillExchangeMediums = seededData.mediumsOfExchange.filter(medium => 
      medium.data.code.includes('SKILL') || medium.data.name.toLowerCase().includes('skill')
    );
    
    if (skillExchangeMediums.length > 0) {
      await expect(page.locator('[data-testid="medium-card"]')).toHaveCount(skillExchangeMediums.length);
    }

    // Clear filter
    await page.selectOption('[data-testid="medium-type-filter"]', 'all');
    await expect(page.locator('[data-testid="medium-card"]')).toHaveCount(seededData.mediumsOfExchange.length);
  });

  test('Admin can view medium usage statistics and relationships', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin mediums of exchange page
    await page.goto('/admin/mediums-of-exchange');

    // Click on a medium to view details
    const firstMedium = seededData.mediumsOfExchange[0];
    await page.click(`text=${firstMedium.data.name}`);

    // Verify medium details page
    await expect(page.locator('[data-testid="medium-details"]')).toBeVisible();
    
    // Check usage statistics section
    await expect(page.locator('[data-testid="usage-statistics"]')).toBeVisible();
    
    // Verify statistics are displayed
    await expect(page.locator('[data-testid="offers-using-medium"]')).toBeVisible();
    await expect(page.locator('[data-testid="requests-using-medium"]')).toBeVisible();
    
    // Check related offers and requests
    const relatedOffers = seededData.offers.filter(offer => 
      offer.mediumOfExchangeHashes.includes(firstMedium.actionHash)
    );
    
    const relatedRequests = seededData.requests.filter(request => 
      request.mediumOfExchangeHashes.includes(firstMedium.actionHash)
    );
    
    // Verify counts match the actual data
    if (relatedOffers.length > 0) {
      await expect(page.locator(`text=${relatedOffers.length} offers`)).toBeVisible();
    }
    
    if (relatedRequests.length > 0) {
      await expect(page.locator(`text=${relatedRequests.length} requests`)).toBeVisible();
    }
  });

  test('Admin can activate and deactivate mediums of exchange', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin mediums of exchange page
    await page.goto('/admin/mediums-of-exchange');

    // Select a medium for status change
    const testMedium = seededData.mediumsOfExchange[0];
    await page.click(`[data-testid="medium-actions-${testMedium.actionHash}"]`);

    // Test deactivation
    await page.click('[data-testid="deactivate-medium"]');
    
    // Provide deactivation reason
    await page.fill('[data-testid="deactivation-reason"]', 'E2E test deactivation - temporary maintenance');
    
    // Confirm deactivation
    await page.click('[data-testid="confirm-deactivation"]');

    // Wait for deactivation to complete
    await expect(page.locator('text=Medium deactivated successfully')).toBeVisible({ timeout: 15000 });

    // Verify status is updated
    await expect(page.locator('[data-testid="medium-status-inactive"]')).toBeVisible();

    // Test reactivation
    await page.click(`[data-testid="medium-actions-${testMedium.actionHash}"]`);
    await page.click('[data-testid="activate-medium"]');
    
    // Provide reactivation reason
    await page.fill('[data-testid="activation-reason"]', 'E2E test reactivation - maintenance completed');
    
    // Confirm reactivation
    await page.click('[data-testid="confirm-activation"]');

    // Wait for reactivation to complete
    await expect(page.locator('text=Medium activated successfully')).toBeVisible({ timeout: 15000 });

    // Verify status is updated
    await expect(page.locator('[data-testid="medium-status-active"]')).toBeVisible();
  });

  test('Admin can manage exchange rates and conversion settings', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin mediums of exchange page
    await page.goto('/admin/mediums-of-exchange');

    // Click on exchange rates management
    await page.click('[data-testid="manage-exchange-rates"]');

    // Verify exchange rates interface
    await expect(page.locator('[data-testid="exchange-rates-management"]')).toBeVisible();

    // Test updating exchange rate for a currency medium
    const currencyMedium = seededData.mediumsOfExchange.find(medium => 
      medium.data.code.includes('CURR') || medium.data.name.toLowerCase().includes('currency')
    );

    if (currencyMedium) {
      await page.fill(`[data-testid="exchange-rate-${currencyMedium.actionHash}"]`, '1.15');
      
      // Save exchange rate update
      await page.click(`[data-testid="save-rate-${currencyMedium.actionHash}"]`);
      
      // Wait for update to complete
      await expect(page.locator('text=Exchange rate updated')).toBeVisible({ timeout: 15000 });
    }

    // Test bulk exchange rate update
    await page.click('[data-testid="bulk-rate-update"]');
    
    // Apply percentage change
    await page.fill('[data-testid="percentage-change"]', '5'); // 5% increase
    await page.selectOption('[data-testid="rate-change-type"]', 'increase');
    
    // Confirm bulk update
    await page.click('[data-testid="confirm-bulk-update"]');
    
    // Wait for bulk update to complete
    await expect(page.locator('text=Bulk exchange rates updated')).toBeVisible({ timeout: 15000 });
  });

  test('Admin can configure medium validation rules', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin mediums of exchange page
    await page.goto('/admin/mediums-of-exchange');

    // Click on validation rules
    await page.click('[data-testid="validation-rules"]');

    // Verify validation rules interface
    await expect(page.locator('[data-testid="validation-rules-management"]')).toBeVisible();

    // Test creating a new validation rule
    await page.click('[data-testid="create-validation-rule"]');
    
    // Fill rule details
    await page.fill('[data-testid="rule-name"]', 'E2E Test Validation Rule');
    await page.fill('[data-testid="rule-description"]', 'Test validation rule for minimum exchange amounts');
    
    // Set rule conditions
    await page.selectOption('[data-testid="rule-type"]', 'minimum_amount');
    await page.fill('[data-testid="minimum-value"]', '10');
    
    // Apply to specific medium types
    await page.check('[data-testid="apply-to-currency"]');
    
    // Save validation rule
    await page.click('[data-testid="save-validation-rule"]');
    
    // Wait for rule creation to complete
    await expect(page.locator('text=Validation rule created')).toBeVisible({ timeout: 15000 });
    
    // Verify rule appears in the list
    await expect(page.locator('text=E2E Test Validation Rule')).toBeVisible();
  });

  test('Admin can generate medium usage reports', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin mediums of exchange page
    await page.goto('/admin/mediums-of-exchange');

    // Click on reports section
    await page.click('[data-testid="medium-reports"]');

    // Verify reports interface
    await expect(page.locator('[data-testid="medium-reports-interface"]')).toBeVisible();

    // Generate usage report
    await page.click('[data-testid="generate-usage-report"]');
    
    // Set report parameters
    await page.selectOption('[data-testid="report-timeframe"]', '30'); // Last 30 days
    await page.check('[data-testid="include-transaction-volume"]');
    await page.check('[data-testid="include-user-adoption"]');
    
    // Generate report
    await page.click('[data-testid="generate-report"]');

    // Wait for report generation
    await expect(page.locator('text=Report generated successfully')).toBeVisible({ timeout: 20000 });

    // Verify download link is available
    await expect(page.locator('[data-testid="download-report"]')).toBeVisible();

    // Test medium comparison report
    await page.click('[data-testid="generate-comparison-report"]');
    
    // Select mediums to compare
    await page.check(`[data-testid="compare-medium-${seededData.mediumsOfExchange[0].actionHash}"]`);
    await page.check(`[data-testid="compare-medium-${seededData.mediumsOfExchange[1].actionHash}"]`);
    
    // Generate comparison
    await page.click('[data-testid="generate-comparison"]');
    
    // Wait for comparison report
    await expect(page.locator('text=Comparison report generated')).toBeVisible({ timeout: 20000 });
  });
});
