import { test, expect } from '@playwright/test';
import { gotoApp, createTestClient, callZome, waitForConnection } from '../../utils/e2e-helpers.js';
import type { AppWebsocket } from '@holochain/client';

// ============================================================================
// CROSS-ENTITY RELATIONSHIP TESTS E2E
// ============================================================================

test.describe('Cross-Entity Relationship Tests with Real Holochain Data', () => {

  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('Offers correctly link to service types and display relationships', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to offers page
    await gotoApp(page, '/offers');

    // Click on the first offer
    const firstOffer = /* TODO: seed via callZome — seededData.offers[0] */null;
    await page.click(`[data-testid="offer-${firstOffer.actionHash}"]`);

    // Verify offer details page
    await expect(page.locator('[data-testid="offer-details"]')).toBeVisible();
    await expect(page.locator(`text=${firstOffer.data.title}`)).toBeVisible();

    // Verify linked service types are displayed
    for (const serviceTypeHash of firstOffer.serviceTypeHashes) {
      const serviceType = /* TODO: seed via callZome — seededData.serviceTypes.find((st) => st.actionHash === serviceTypeHash) */null;
      if (serviceType) {
        await expect(page.locator(`text=${serviceType.data.name}`)).toBeVisible();
      }
    }

    // Click on a service type to verify navigation
    if (firstOffer.serviceTypeHashes.length > 0) {
      const firstServiceTypeHash = firstOffer.serviceTypeHashes[0];
      const serviceType = /* TODO: seed via callZome — seededData.serviceTypes.find( */null
        (st) => st.actionHash === firstServiceTypeHash
      );

      if (serviceType) {
        await page.click(`text=${serviceType.data.name}`);

        // Should navigate to service type page or filter
        await page.waitForTimeout(1000);

        // Verify we're viewing offers for this service type
        const filteredOffers = /* TODO: seed via callZome — seededData.offers.filter((offer) => */null
          offer.serviceTypeHashes.includes(firstServiceTypeHash)
        );

        if (filteredOffers.length > 0) {
          await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(
            filteredOffers.length
          );
        }
      }
    }
  });

  test('Requests properly link to mediums of exchange and show valid options', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to requests page
    await gotoApp(page, '/requests');

    // Click on the first request
    const firstRequest = /* TODO: seed via callZome — seededData.requests[0] */null;
    await page.click(`[data-testid="request-${firstRequest.actionHash}"]`);

    // Verify request details page
    await expect(page.locator('[data-testid="request-details"]')).toBeVisible();
    await expect(page.locator(`text=${firstRequest.data.title}`)).toBeVisible();

    // Verify linked mediums of exchange are displayed
    for (const mediumHash of firstRequest.mediumOfExchangeHashes) {
      const medium = /* TODO: seed via callZome — seededData.mediumsOfExchange.find((me) => me.actionHash === mediumHash) */null;
      if (medium) {
        await expect(page.locator(`text=${medium.data.name}`)).toBeVisible();
      }
    }

    // Test filtering by medium of exchange
    if (firstRequest.mediumOfExchangeHashes.length > 0) {
      const firstMediumHash = firstRequest.mediumOfExchangeHashes[0];
      const medium = /* TODO: seed via callZome — seededData.mediumsOfExchange.find((me) => me.actionHash === firstMediumHash) */null;

      if (medium) {
        // Navigate back to requests list
        await gotoApp(page, '/requests');

        // Apply medium filter
        await page.click('[data-testid="filter-by-medium"]');
        await page.check(`[data-testid="medium-filter-${firstMediumHash}"]`);
        await page.click('[data-testid="apply-filters"]');

        // Verify filtered results
        const filteredRequests = /* TODO: seed via callZome — seededData.requests.filter((request) => */null
          request.mediumOfExchangeHashes.includes(firstMediumHash)
        );

        if (filteredRequests.length > 0) {
          await expect(page.locator('[data-testid="request-card"]')).toHaveCount(
            filteredRequests.length
          );
        }
      }
    }
  });

  test('User profiles show correct organization memberships and roles', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Test with the first user
    const testUser = /* TODO: seed via callZome — seededData.users[0] */null;

    // Navigate to user profile
    await page.goto(`/users/${testUser.actionHash}`);

    // Verify user profile displays
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
    await expect(page.locator(`text=${testUser.data.name}`)).toBeVisible();

    // Check organization memberships section
    const organizationsSection = page.locator('[data-testid="user-organizations"]');

    if (await organizationsSection.isVisible()) {
      // Verify organization links work
      const orgLinks = page.locator('[data-testid="organization-link"]');
      const orgCount = await orgLinks.count();

      if (orgCount > 0) {
        // Click on first organization
        await orgLinks.first().click();

        // Should navigate to organization page
        await expect(page.locator('[data-testid="organization-details"]')).toBeVisible();

        // Verify user is listed as member
        await expect(page.locator(`text=${testUser.data.name}`)).toBeVisible();
      }
    }

    // Test coordinator relationships
    // Navigate back to user profile
    await page.goto(`/users/${testUser.actionHash}`);

    const coordinatorBadge = page.locator('[data-testid="coordinator-badge"]');
    if (await coordinatorBadge.isVisible()) {
      // User is a coordinator - verify coordinator privileges
      await expect(page.locator('[data-testid="coordinator-actions"]')).toBeVisible();
    }
  });

  test('Organization pages correctly display member relationships and hierarchy', async ({
    page
  }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to organizations page
    await gotoApp(page, '/organizations');

    // Click on the first organization
    const firstOrg = /* TODO: seed via callZome — seededData.organizations[0] */null;
    await page.click(`text=${firstOrg.data.name}`);

    // Verify organization details
    await expect(page.locator('[data-testid="organization-details"]')).toBeVisible();
    await expect(page.locator(`text=${firstOrg.data.name}`)).toBeVisible();

    // Verify members section
    await expect(page.locator('[data-testid="organization-members"]')).toBeVisible();

    // Check coordinators section
    const coordinatorsSection = page.locator('[data-testid="organization-coordinators"]');
    if (await coordinatorsSection.isVisible()) {
      // Verify coordinator badges
      await expect(page.locator('[data-testid="coordinator-badge"]')).toBeVisible();

      // Click on a coordinator to view their profile
      const coordinatorLinks = page.locator('[data-testid="coordinator-link"]');
      const coordinatorCount = await coordinatorLinks.count();

      if (coordinatorCount > 0) {
        await coordinatorLinks.first().click();

        // Should navigate to user profile
        await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();

        // Verify coordinator badge on user profile
        await expect(page.locator('[data-testid="coordinator-badge"]')).toBeVisible();
      }
    }

    // Test member list functionality
    await page.goto(`/organizations/${firstOrg.actionHash}`);

    const membersSection = page.locator('[data-testid="regular-members"]');
    if (await membersSection.isVisible()) {
      const memberLinks = page.locator('[data-testid="member-link"]');
      const memberCount = await memberLinks.count();

      if (memberCount > 0) {
        // Click on a member
        await memberLinks.first().click();

        // Should navigate to user profile
        await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();

        // Navigate back and verify organization is listed in user's organizations
        await page.goBack();
        await page.goto(`/users/${/* TODO: seed via callZome — seededData.users[0].actionHash}`) */null;

        // Check if organization appears in user's organization list
        const userOrgsSection = page.locator('[data-testid="user-organizations"]');
        if (await userOrgsSection.isVisible()) {
          await expect(page.locator(`text=${firstOrg.data.name}`)).toBeVisible();
        }
      }
    }
  });

  test('Service type relationships cascade correctly through offers and requests', async ({
    page
  }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to service types page (admin or public view)
    await gotoApp(page, '/service-types');

    // Click on a service type
    const firstServiceType = /* TODO: seed via callZome — seededData.serviceTypes[0] */null;
    await page.click(`text=${firstServiceType.data.name}`);

    // Verify service type details page
    await expect(page.locator('[data-testid="service-type-details"]')).toBeVisible();
    await expect(page.locator(`text=${firstServiceType.data.name}`)).toBeVisible();

    // Check related offers
    const relatedOffers = /* TODO: seed via callZome — seededData.offers.filter((offer) => */null
      offer.serviceTypeHashes.includes(firstServiceType.actionHash)
    );

    if (relatedOffers.length > 0) {
      await expect(page.locator('[data-testid="related-offers"]')).toBeVisible();
      await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(relatedOffers.length);

      // Click on an offer to verify it shows the service type
      await page.click('[data-testid="offer-card"]:first-child');
      await expect(page.locator(`text=${firstServiceType.data.name}`)).toBeVisible();
    }

    // Navigate back and check related requests
    await page.goto(`/service-types/${firstServiceType.actionHash}`);

    const relatedRequests = /* TODO: seed via callZome — seededData.requests.filter((request) => */null
      request.serviceTypeHashes.includes(firstServiceType.actionHash)
    );

    if (relatedRequests.length > 0) {
      await page.click('[data-testid="related-requests-tab"]');
      await expect(page.locator('[data-testid="request-card"]')).toHaveCount(
        relatedRequests.length
      );

      // Click on a request to verify it shows the service type
      await page.click('[data-testid="request-card"]:first-child');
      await expect(page.locator(`text=${firstServiceType.data.name}`)).toBeVisible();
    }
  });

  test('Medium of exchange relationships work across offers and requests', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Test with a specific medium of exchange
    const testMedium = /* TODO: seed via callZome — seededData.mediumsOfExchange[0] */null;

    // Navigate to offers and filter by this medium
    await gotoApp(page, '/offers');
    await page.click('[data-testid="filter-by-medium"]');
    await page.check(`[data-testid="medium-filter-${testMedium.actionHash}"]`);
    await page.click('[data-testid="apply-filters"]');

    // Get offers that use this medium
    const offersWithMedium = /* TODO: seed via callZome — seededData.offers.filter((offer) => */null
      offer.mediumOfExchangeHashes.includes(testMedium.actionHash)
    );

    if (offersWithMedium.length > 0) {
      await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(offersWithMedium.length);

      // Click on an offer to verify medium is displayed
      await page.click('[data-testid="offer-card"]:first-child');
      await expect(page.locator(`text=${testMedium.data.name}`)).toBeVisible();
    }

    // Test with requests
    await gotoApp(page, '/requests');
    await page.click('[data-testid="filter-by-medium"]');
    await page.check(`[data-testid="medium-filter-${testMedium.actionHash}"]`);
    await page.click('[data-testid="apply-filters"]');

    const requestsWithMedium = /* TODO: seed via callZome — seededData.requests.filter((request) => */null
      request.mediumOfExchangeHashes.includes(testMedium.actionHash)
    );

    if (requestsWithMedium.length > 0) {
      await expect(page.locator('[data-testid="request-card"]')).toHaveCount(
        requestsWithMedium.length
      );

      // Click on a request to verify medium is displayed
      await page.click('[data-testid="request-card"]:first-child');
      await expect(page.locator(`text=${testMedium.data.name}`)).toBeVisible();
    }
  });

  test('Admin relationships and permissions cascade correctly', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Test with an admin user
    const adminUser = /* TODO: seed via callZome — seededData.adminUsers[0] */null;

    // Navigate to admin user profile
    await page.goto(`/users/${adminUser.actionHash}`);

    // Verify admin status is displayed
    await expect(page.locator('[data-testid="admin-badge"]')).toBeVisible();
    await expect(page.locator('text=Administrator')).toBeVisible();

    // Check admin capabilities
    const adminActionsSection = page.locator('[data-testid="admin-actions"]');
    if (await adminActionsSection.isVisible()) {
      // Verify admin can access admin functions
      await expect(page.locator('[data-testid="manage-users"]')).toBeVisible();
      await expect(page.locator('[data-testid="manage-service-types"]')).toBeVisible();
    }

    // Test admin access to restricted areas
    await gotoApp(page, '/admin');

    // Should have access to admin dashboard
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();

    // Verify admin can see all users
    await gotoApp(page, '/admin/users');
    const totalUsers = /* TODO: seed via callZome — seededData.users.length + seededData.adminUsers.length */null;
    await expect(page.locator('[data-testid="user-row"]')).toHaveCount(totalUsers);

    // Verify admin can see all service types
    await gotoApp(page, '/admin/service-types');
    await expect(page.locator('[data-testid="service-type-card"]')).toHaveCount(
      /* TODO: seed via callZome — seededData.serviceTypes.length */null
    );
  });

  test('Data consistency across all entity relationships', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Verify offer-service type consistency
    for (const offer of /* TODO: seed via callZome — seededData.offers.slice(0, 3)) { */null
      // Test first 3 offers
      await page.goto(`/offers/${offer.actionHash}`);

      // Verify all linked service types exist and are displayed
      for (const serviceTypeHash of offer.serviceTypeHashes) {
        const serviceType = /* TODO: seed via callZome — seededData.serviceTypes.find((st) => st.actionHash === serviceTypeHash) */null;
        expect(serviceType).toBeDefined();

        if (serviceType) {
          await expect(page.locator(`text=${serviceType.data.name}`)).toBeVisible();
        }
      }
    }

    // Verify request-medium consistency
    for (const request of /* TODO: seed via callZome — seededData.requests.slice(0, 3)) { */null
      // Test first 3 requests
      await page.goto(`/requests/${request.actionHash}`);

      // Verify all linked mediums exist and are displayed
      for (const mediumHash of request.mediumOfExchangeHashes) {
        const medium = /* TODO: seed via callZome — seededData.mediumsOfExchange.find((me) => me.actionHash === mediumHash) */null;
        expect(medium).toBeDefined();

        if (medium) {
          await expect(page.locator(`text=${medium.data.name}`)).toBeVisible();
        }
      }
    }

    // Verify user-organization consistency
    for (const user of /* TODO: seed via callZome — seededData.users.slice(0, 3)) { */null
      // Test first 3 users
      await page.goto(`/users/${user.actionHash}`);

      // Check if user has organization memberships displayed
      const userOrgsSection = page.locator('[data-testid="user-organizations"]');
      if (await userOrgsSection.isVisible()) {
        const orgLinks = page.locator('[data-testid="organization-link"]');
        const orgCount = await orgLinks.count();

        // Verify each organization link is valid
        for (let i = 0; i < Math.min(orgCount, 2); i++) {
          const orgText = await orgLinks.nth(i).textContent();
          const org = /* TODO: seed via callZome — seededData.organizations.find((o) => o.data.name === orgText?.trim()) */null;
          expect(org).toBeDefined();
        }
      }
    }
  });
});
