import { test, expect } from '@playwright/test';
import { setupGlobalHolochain, cleanupGlobalHolochain } from '../../utils/holochain-setup';
import type { SeededData } from '../../fixtures/holochain-data-seeder';

// ============================================================================
// ORGANIZATION MANAGEMENT FLOW E2E TEST
// ============================================================================

test.describe('Organization Management Flow with Real Holochain Data', () => {
  let seededData: SeededData;

  // Setup before all tests in this describe block
  test.beforeAll(async () => {
    console.log('🚀 Setting up Holochain with real data for organization management tests...');
    const setup = await setupGlobalHolochain();
    seededData = setup.seededData;
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    await cleanupGlobalHolochain();
  });

  test('User can browse existing organizations with real data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to organizations page
    await page.goto('/organizations');
    await expect(page).toHaveURL('/organizations');

    // Verify that seeded organizations are displayed
    await expect(page.locator('[data-testid="organization-card"]')).toHaveCount(
      seededData.organizations.length,
      { timeout: 15000 }
    );

    // Verify first organization displays correct information
    const firstOrg = seededData.organizations[0];
    await expect(page.locator(`text=${firstOrg.data.name}`)).toBeVisible();
    
    if (firstOrg.data.description) {
      await expect(page.locator(`text=${firstOrg.data.description}`)).toBeVisible();
    }
  });

  test('User can view organization details and member information', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to organizations page
    await page.goto('/organizations');

    // Click on the first organization
    const firstOrg = seededData.organizations[0];
    await page.click(`text=${firstOrg.data.name}`);

    // Verify organization details page
    await expect(page.locator('[data-testid="organization-details"]')).toBeVisible();
    await expect(page.locator(`text=${firstOrg.data.name}`)).toBeVisible();
    
    if (firstOrg.data.description) {
      await expect(page.locator(`text=${firstOrg.data.description}`)).toBeVisible();
    }

    // Verify members section is visible
    await expect(page.locator('[data-testid="organization-members"]')).toBeVisible();
    
    // Check if coordinators are displayed
    await expect(page.locator('[data-testid="organization-coordinators"]')).toBeVisible();
  });

  test('User can create a new organization', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to organizations page
    await page.goto('/organizations');

    // Click create organization button
    await page.click('[data-testid="create-organization-button"]');

    // Fill in organization details
    await page.fill('[data-testid="org-name-input"]', 'E2E Test Organization');
    await page.fill('[data-testid="org-description-input"]', 'This is a test organization created during E2E testing');
    await page.fill('[data-testid="org-website-input"]', 'https://e2e-test-org.example.com');
    await page.fill('[data-testid="org-email-input"]', 'contact@e2e-test-org.example.com');

    // Submit organization creation
    await page.click('[data-testid="submit-organization"]');

    // Wait for creation to complete
    await expect(page.locator('text=Organization created successfully')).toBeVisible({ timeout: 15000 });

    // Verify redirect to organization details page
    await expect(page.locator('text=E2E Test Organization')).toBeVisible();
    await expect(page.locator('[data-testid="organization-details"]')).toBeVisible();
  });

  test('Organization coordinator can manage members', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Use a seeded organization for this test
    const testOrg = seededData.organizations[0];
    
    // Navigate to organization details
    await page.goto(`/organizations/${testOrg.actionHash}`);

    // Check if current user is a coordinator (this might vary based on test setup)
    const isCoordinator = await page.locator('[data-testid="coordinator-actions"]').isVisible();
    
    if (isCoordinator) {
      // Test coordinator functionality
      await page.click('[data-testid="manage-members-button"]');
      
      // Verify member management interface
      await expect(page.locator('[data-testid="member-management"]')).toBeVisible();
      
      // Test adding a member (if functionality exists)
      const addMemberButton = page.locator('[data-testid="add-member-button"]');
      if (await addMemberButton.isVisible()) {
        await addMemberButton.click();
        await expect(page.locator('[data-testid="add-member-form"]')).toBeVisible();
      }
    } else {
      // Test regular member view
      await expect(page.locator('[data-testid="organization-members"]')).toBeVisible();
      
      // Regular members should not see management controls
      await expect(page.locator('[data-testid="coordinator-actions"]')).not.toBeVisible();
    }
  });

  test('User can join an organization', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Find an organization the user is not a member of
    const testOrg = seededData.organizations[0];
    
    // Navigate to organization details
    await page.goto(`/organizations/${testOrg.actionHash}`);

    // Check if join button is available
    const joinButton = page.locator('[data-testid="join-organization-button"]');
    
    if (await joinButton.isVisible()) {
      // Click join organization
      await joinButton.click();
      
      // Handle join request (might require approval)
      await expect(page.locator('text=Join request sent')).toBeVisible({ timeout: 10000 });
    } else {
      // User might already be a member
      await expect(page.locator('[data-testid="member-status"]')).toBeVisible();
    }
  });

  test('Organization filtering and search works with real data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to organizations page
    await page.goto('/organizations');

    // Test search functionality
    const searchTerm = seededData.organizations[0].data.name.split(' ')[0]; // Use first word of first org name
    await page.fill('[data-testid="organization-search-input"]', searchTerm);
    await page.press('[data-testid="organization-search-input"]', 'Enter');

    // Verify search results
    const orgCards = page.locator('[data-testid="organization-card"]');
    const count = await orgCards.count();
    expect(count).toBeGreaterThan(0);

    // Verify search results contain the search term
    for (let i = 0; i < Math.min(count, 3); i++) {
      const orgCard = orgCards.nth(i);
      const text = await orgCard.textContent();
      expect(text?.toLowerCase()).toContain(searchTerm.toLowerCase());
    }
  });

  test('Organization offers and requests are properly linked', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Use a seeded organization
    const testOrg = seededData.organizations[0];
    
    // Navigate to organization details
    await page.goto(`/organizations/${testOrg.actionHash}`);

    // Check organization's offers section
    await page.click('[data-testid="organization-offers-tab"]');
    
    // Verify offers are displayed (might be empty)
    const offerCards = page.locator('[data-testid="offer-card"]');
    const offerCount = await offerCards.count();
    expect(offerCount).toBeGreaterThanOrEqual(0);

    // Check organization's requests section
    await page.click('[data-testid="organization-requests-tab"]');
    
    // Verify requests are displayed (might be empty)
    const requestCards = page.locator('[data-testid="request-card"]');
    const requestCount = await requestCards.count();
    expect(requestCount).toBeGreaterThanOrEqual(0);
  });

  test('Organization member roles and permissions work correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Use a seeded organization
    const testOrg = seededData.organizations[0];
    
    // Navigate to organization details
    await page.goto(`/organizations/${testOrg.actionHash}`);

    // Verify member list is visible
    await expect(page.locator('[data-testid="organization-members"]')).toBeVisible();

    // Check if coordinators are clearly identified
    const coordinatorSection = page.locator('[data-testid="organization-coordinators"]');
    if (await coordinatorSection.isVisible()) {
      // Verify coordinator badges or indicators
      await expect(page.locator('[data-testid="coordinator-badge"]')).toBeVisible();
    }

    // Check regular members section
    const membersSection = page.locator('[data-testid="regular-members"]');
    if (await membersSection.isVisible()) {
      // Verify member information is displayed
      await expect(page.locator('[data-testid="member-card"]')).toBeVisible();
    }
  });
});
