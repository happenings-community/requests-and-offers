import { test, expect } from '@playwright/test';
import { gotoApp, createTestClient, callZome, waitForConnection } from '../../utils/e2e-helpers.js';
import type { AppWebsocket } from '@holochain/client';

// ============================================================================
// COMPLETE OFFER-REQUEST FLOW E2E TEST
// ============================================================================

test.describe('Complete Offer-Request Flow with Real Holochain Data', () => {

  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('User can browse offers, view details, and see real Holochain data', async ({ page }) => {
    // Navigate to the application
    await gotoApp(page, '/');

    // Wait for Holochain connection
    await waitForConnection(page);

    // Navigate to offers page
    await page.click('a[href="/offers"]');
    await expect(page).toHaveURL('/offers');

    // Verify that real offers from seeded data are displayed
    await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(/* TODO: seed via callZome — seededData.offers.length, { */null
      timeout: 15000
    });

    // Check that the first offer contains real data
    const firstOffer = /* TODO: seed via callZome — seededData.offers[0] */null;
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
      const linkedServiceType = /* TODO: seed via callZome — seededData.serviceTypes.find((st) => */null
        firstOffer.serviceTypeHashes.includes(st.actionHash)
      );
      if (linkedServiceType) {
        await expect(page.locator(`text=${linkedServiceType.data.name}`)).toBeVisible();
      }
    }
  });

  test('User can browse requests and see realistic data relationships', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to requests page
    await page.click('a[href="/requests"]');
    await expect(page).toHaveURL('/requests');

    // Verify that real requests are displayed
    await expect(page.locator('[data-testid="request-card"]')).toHaveCount(
      /* TODO: seed via callZome — seededData.requests.length, */null
      { timeout: 15000 }
    );

    // Test filtering by service type using real seeded data
    const webDevServiceType = /* TODO: seed via callZome — seededData.serviceTypes.find( */null
      (st) => st.data.name === 'Web Development'
    );
    if (webDevServiceType) {
      // Click on service type filter
      await page.click('[data-testid="service-type-filter"]');
      await page.click(`text=${webDevServiceType.data.name}`);

      // Verify that only requests linked to this service type are shown
      const filteredRequests = /* TODO: seed via callZome — seededData.requests.filter((req) => */null
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
    const adminUser = /* TODO: seed via callZome — seededData.adminUsers[0] */null;
    expect(adminUser).toBeDefined();
    expect(adminUser.isAdmin).toBe(true);

    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to admin area (assuming admin users have access)
    await gotoApp(page, '/admin');

    // Navigate to service types management
    await page.click('a[href="/admin/service-types"]');
    await expect(page).toHaveURL('/admin/service-types');

    // Verify that seeded service types are displayed
    for (const serviceType of /* TODO: seed via callZome — seededData.serviceTypes) { */null
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
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to create offer page
    await gotoApp(page, '/offers/create');

    // Fill in offer details
    await page.fill('[data-testid="offer-title-input"]', 'E2E Test Offer');
    await page.fill(
      '[data-testid="offer-description-input"]',
      'This is an offer created during E2E testing with real Holochain data'
    );

    // Select a real service type from seeded data
    const webDevServiceType = /* TODO: seed via callZome — seededData.serviceTypes.find( */null
      (st) => st.data.name === 'Web Development'
    );
    if (webDevServiceType) {
      await page.click('[data-testid="service-type-selector"]');
      await page.click(`[data-value="${webDevServiceType.actionHash}"]`);
    }

    // Select a real medium of exchange
    const usdMedium = /* TODO: seed via callZome — seededData.mediumsOfExchange.find((me) => me.data.code === 'USD') */null;
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
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Test search on offers page
    await gotoApp(page, '/offers');

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
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to user profile (assuming current user is one of the seeded users)
    await gotoApp(page, '/profile');

    // Verify that user profile data is displayed
    // Note: This assumes the current agent corresponds to one of our seeded users
    const currentUser = /* TODO: seed via callZome — seededData.users[0] */null; // For testing purposes

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
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to organizations page
    await gotoApp(page, '/organizations');

    // Verify that seeded organizations are displayed
    await expect(page.locator('[data-testid="organization-card"]')).toHaveCount(
      /* TODO: seed via callZome — seededData.organizations.length, */null
      { timeout: 15000 }
    );

    // Click on the first organization
    const firstOrg = /* TODO: seed via callZome — seededData.organizations[0] */null;
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

// TODO: Replace getSeededDataHelper / findUserByName / findOrganizationByName
// with direct zome calls using createTestClient() + callZome() from e2e-helpers.js
