import { test, expect } from '@playwright/test';
import {
  setupGlobalHolochain,
  cleanupGlobalHolochain,
  getGlobalHolochainSetup
} from '../../utils/holochain-setup';
import type { SeededData } from '../../fixtures/holochain-data-seeder';

// ============================================================================
// COMPLETE OFFER-REQUEST FLOW E2E TEST
// ============================================================================

test.describe('Complete Offer-Request Flow with Real Holochain Data', () => {
  let seededData: SeededData;

  // Setup before all tests in this describe block
  test.beforeAll(async () => {
    console.log('🚀 Setting up Holochain with real data for offer-request flow tests...');
    const setup = await setupGlobalHolochain();
    seededData = setup.seededData;
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    await cleanupGlobalHolochain();
  });

  test('User can browse offers, view details, and see real Holochain data', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for Holochain connection
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to offers page
    await page.click('a[href="/offers"]');
    await expect(page).toHaveURL('/offers');

    // Verify that real offers from seeded data are displayed
    await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(seededData.offers.length, {
      timeout: 15000
    });

    // Check that the first offer contains real data
    const firstOffer = seededData.offers[0];
    await expect(page.locator(`text=${firstOffer.data.title}`)).toBeVisible();

    // Click on the first offer to view details
    await page.click(`text=${firstOffer.data.title}`);

    // Verify we're on the offer detail page
    await expect(page).toHaveURL(new RegExp(`/offers/.*`));

    // Verify offer details are displayed
    await expect(page.locator(`text=${firstOffer.data.title}`)).toBeVisible();
    await expect(page.locator(`text=${firstOffer.data.description}`)).toBeVisible();

    // Verify service types are linked and displayed
    if (firstOffer.serviceTypeHashes.length > 0) {
      const linkedServiceType = seededData.serviceTypes.find((st) =>
        firstOffer.serviceTypeHashes.includes(st.actionHash)
      );
      if (linkedServiceType) {
        await expect(page.locator(`text=${linkedServiceType.data.name}`)).toBeVisible();
      }
    }
  });

  test('User can browse requests and see realistic data relationships', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to requests page
    await page.click('a[href="/requests"]');
    await expect(page).toHaveURL('/requests');

    // Verify that real requests are displayed
    await expect(page.locator('[data-testid="request-card"]')).toHaveCount(
      seededData.requests.length,
      { timeout: 15000 }
    );

    // Test filtering by service type using real seeded data
    const webDevServiceType = seededData.serviceTypes.find(
      (st) => st.data.name === 'Web Development'
    );
    if (webDevServiceType) {
      // Click on service type filter
      await page.click('[data-testid="service-type-filter"]');
      await page.click(`text=${webDevServiceType.data.name}`);

      // Verify that only requests linked to this service type are shown
      const filteredRequests = seededData.requests.filter((req) =>
        req.serviceTypeHashes.includes(webDevServiceType.actionHash)
      );

      if (filteredRequests.length > 0) {
        await expect(page.locator('[data-testid="request-card"]')).toHaveCount(
          filteredRequests.length
        );
      }
    }
  });

  test('Admin user can manage service types with real data', async ({ page }) => {
    // Get an admin user from seeded data
    const adminUser = seededData.adminUsers[0];
    expect(adminUser).toBeDefined();
    expect(adminUser.isAdmin).toBe(true);

    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin area (assuming admin users have access)
    await page.goto('/admin');

    // Navigate to service types management
    await page.click('a[href="/admin/service-types"]');
    await expect(page).toHaveURL('/admin/service-types');

    // Verify that seeded service types are displayed
    for (const serviceType of seededData.serviceTypes) {
      await expect(page.locator(`text=${serviceType.data.name}`)).toBeVisible();
    }

    // Test creating a new service type
    await page.click('[data-testid="create-service-type-btn"]');

    const newServiceTypeName = 'E2E Test Service Type';
    await page.fill('[data-testid="service-type-name-input"]', newServiceTypeName);
    await page.fill(
      '[data-testid="service-type-description-input"]',
      'A service type created during E2E testing'
    );
    await page.fill('[data-testid="service-type-tags-input"]', 'testing, e2e, automation');

    await page.click('[data-testid="submit-service-type-btn"]');

    // Verify the new service type appears in the list
    await expect(page.locator(`text=${newServiceTypeName}`)).toBeVisible();
  });

  test('User can create offer linked to real service types and mediums', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to create offer page
    await page.goto('/offers/create');

    // Fill in offer details
    await page.fill('[data-testid="offer-title-input"]', 'E2E Test Offer');
    await page.fill(
      '[data-testid="offer-description-input"]',
      'This is an offer created during E2E testing with real Holochain data'
    );

    // Select a real service type from seeded data
    const webDevServiceType = seededData.serviceTypes.find(
      (st) => st.data.name === 'Web Development'
    );
    if (webDevServiceType) {
      await page.click('[data-testid="service-type-selector"]');
      await page.click(`[data-value="${webDevServiceType.actionHash}"]`);
    }

    // Select a real medium of exchange
    const usdMedium = seededData.mediumsOfExchange.find((me) => me.data.code === 'USD');
    if (usdMedium) {
      await page.click('[data-testid="medium-selector"]');
      await page.click(`[data-value="${usdMedium.actionHash}"]`);
    }

    // Set other preferences
    await page.selectOption('[data-testid="time-preference-select"]', 'Afternoon');
    await page.selectOption('[data-testid="interaction-type-select"]', 'Virtual');

    // Submit the offer
    await page.click('[data-testid="submit-offer-btn"]');

    // Verify redirect to offers list and new offer is visible
    await expect(page).toHaveURL('/offers');
    await expect(page.locator('text=E2E Test Offer')).toBeVisible();
  });

  test('Search functionality works with real seeded data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Test search on offers page
    await page.goto('/offers');

    // Search for a term that should exist in seeded data
    const searchTerm = 'design'; // Should match some offers
    await page.fill('[data-testid="search-input"]', searchTerm);
    await page.press('[data-testid="search-input"]', 'Enter');

    // Verify that search results are displayed
    const offerCards = page.locator('[data-testid="offer-card"]');
    const count = await offerCards.count();
    expect(count).toBeGreaterThan(0);

    // Verify that displayed offers contain the search term

    for (let i = 0; i < count; i++) {
      const offerCard = offerCards.nth(i);
      const text = await offerCard.textContent();
      expect(text?.toLowerCase()).toContain(searchTerm.toLowerCase());
    }
  });

  test('User profile displays real user data and relationships', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to user profile (assuming current user is one of the seeded users)
    await page.goto('/profile');

    // Verify that user profile data is displayed
    // Note: This assumes the current agent corresponds to one of our seeded users
    const currentUser = seededData.users[0]; // For testing purposes

    // Check if user data is properly displayed
    await expect(page.locator('[data-testid="user-name"]')).toContainText(currentUser.data.name);
    await expect(page.locator('[data-testid="user-email"]')).toContainText(currentUser.data.email);
    await expect(page.locator('[data-testid="user-location"]')).toContainText(
      currentUser.data.location
    );

    // Verify skills are displayed
    for (const skill of currentUser.data.skills.slice(0, 3)) {
      // Check first 3 skills
      await expect(page.locator(`text=${skill}`)).toBeVisible();
    }
  });

  test('Organization management works with real organization data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to organizations page
    await page.goto('/organizations');

    // Verify that seeded organizations are displayed
    await expect(page.locator('[data-testid="organization-card"]')).toHaveCount(
      seededData.organizations.length,
      { timeout: 15000 }
    );

    // Click on the first organization
    const firstOrg = seededData.organizations[0];
    await page.click(`text=${firstOrg.data.name}`);

    // Verify organization details page
    await expect(page).toHaveURL(new RegExp(`/organizations/.*`));
    await expect(page.locator(`text=${firstOrg.data.name}`)).toBeVisible();
    await expect(page.locator(`text=${firstOrg.data.description}`)).toBeVisible();
    await expect(page.locator(`text=${firstOrg.data.email}`)).toBeVisible();

    // Verify organization URLs are displayed
    for (const url of firstOrg.data.urls) {
      await expect(page.locator(`a[href="${url}"]`)).toBeVisible();
    }
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper to get specific seeded data for testing
 */
function getSeededDataHelper() {
  const setup = getGlobalHolochainSetup();
  return setup.getSeededData();
}

/**
 * Helper to find user by name in seeded data
 */
function findUserByName(name: string) {
  const setup = getGlobalHolochainSetup();
  return setup.getUserByName(name);
}

/**
 * Helper to find organization by name in seeded data
 */
function findOrganizationByName(name: string) {
  const setup = getGlobalHolochainSetup();
  return setup.getOrganizationByName(name);
}
