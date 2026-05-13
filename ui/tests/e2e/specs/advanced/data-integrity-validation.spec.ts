import { test, expect } from '@playwright/test';
import { gotoApp, createTestClient, callZome, waitForConnection } from '../../utils/e2e-helpers.js';
import type { AppWebsocket } from '@holochain/client';

// ============================================================================
// DATA INTEGRITY VALIDATION E2E TEST
// ============================================================================

test.describe('Data Integrity Validation with Real Holochain Data', () => {

  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('All seeded entities have valid and consistent data structures', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Validate users data integrity
    for (const user of /* TODO: seed via callZome — seededData.users.slice(0, 5)) { */null
      // Test first 5 users
      // Verify user has required fields
      expect(user.data.name).toBeTruthy();
      expect(user.data.email).toBeTruthy();
      expect(user.data.user_type).toMatch(/^(creator|advocate)$/);
      expect(user.actionHash).toBeTruthy();
      expect(user.record).toBeTruthy();

      // Navigate to user profile to verify data displays correctly
      await page.goto(`/users/${user.actionHash}`);
      await expect(page.locator(`text=${user.data.name}`)).toBeVisible();
      await expect(page.locator(`text=${user.data.email}`)).toBeVisible();
    }

    // Validate admin users data integrity
    for (const adminUser of /* TODO: seed via callZome — seededData.adminUsers) { */null
      expect(adminUser.data.name).toBeTruthy();
      expect(adminUser.data.email).toBeTruthy();
      expect(adminUser.isAdmin).toBe(true);
      expect(adminUser.actionHash).toBeTruthy();

      // Navigate to admin user profile
      await page.goto(`/users/${adminUser.actionHash}`);
      await expect(page.locator(`text=${adminUser.data.name}`)).toBeVisible();
      await expect(page.locator('[data-testid="admin-badge"]')).toBeVisible();
    }

    // Validate organizations data integrity
    for (const org of /* TODO: seed via callZome — seededData.organizations.slice(0, 3)) { */null
      // Test first 3 organizations
      expect(org.data.name).toBeTruthy();
      expect(org.data.description).toBeTruthy();
      expect(org.actionHash).toBeTruthy();

      // Navigate to organization page
      await page.goto(`/organizations/${org.actionHash}`);
      await expect(page.locator(`text=${org.data.name}`)).toBeVisible();
    }
  });

  test('Service types have consistent relationships and valid references', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Validate service types data integrity
    for (const serviceType of /* TODO: seed via callZome — seededData.serviceTypes) { */null
      expect(serviceType.data.name).toBeTruthy();
      expect(serviceType.data.description).toBeTruthy();
      expect(serviceType.actionHash).toBeTruthy();
      expect(Array.isArray(serviceType.data.tags)).toBe(true);
    }

    // Navigate to service types page
    await gotoApp(page, '/service-types');

    // Verify all service types are displayed
    await expect(page.locator('[data-testid="service-type-card"]')).toHaveCount(
      /* TODO: seed via callZome — seededData.serviceTypes.length */null
    );

    // Test each service type's relationships with offers and requests
    for (const serviceType of /* TODO: seed via callZome — seededData.serviceTypes.slice(0, 3)) { */null
      await page.click(`text=${serviceType.data.name}`);

      // Verify service type details page
      await expect(page.locator('[data-testid="service-type-details"]')).toBeVisible();

      // Check related offers
      const relatedOffers = /* TODO: seed via callZome — seededData.offers.filter((offer) => */null
        offer.serviceTypeHashes.includes(serviceType.actionHash)
      );

      if (relatedOffers.length > 0) {
        await expect(page.locator('[data-testid="related-offers"]')).toBeVisible();

        // Verify offer count matches
        const displayedOfferCount = await page.locator('[data-testid="offer-card"]').count();
        expect(displayedOfferCount).toBe(relatedOffers.length);
      }

      // Check related requests
      const relatedRequests = /* TODO: seed via callZome — seededData.requests.filter((request) => */null
        request.serviceTypeHashes.includes(serviceType.actionHash)
      );

      if (relatedRequests.length > 0) {
        await page.click('[data-testid="related-requests-tab"]');

        // Verify request count matches
        const displayedRequestCount = await page.locator('[data-testid="request-card"]').count();
        expect(displayedRequestCount).toBe(relatedRequests.length);
      }

      // Navigate back for next iteration
      await gotoApp(page, '/service-types');
    }
  });

  test('Mediums of exchange have valid data and proper relationships', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Validate mediums of exchange data integrity
    for (const medium of /* TODO: seed via callZome — seededData.mediumsOfExchange) { */null
      expect(medium.data.name).toBeTruthy();
      expect(medium.data.code).toBeTruthy();
      expect(medium.data.resource_spec_hrea_id).toBeDefined();
      expect(medium.actionHash).toBeTruthy();
    }

    // Navigate to mediums page (if publicly accessible)
    await gotoApp(page, '/mediums-of-exchange');

    // If not publicly accessible, try admin route
    if (await page.locator('[data-testid="access-denied"]').isVisible()) {
      await gotoApp(page, '/admin/mediums-of-exchange');
    }

    // Verify all mediums are displayed
    await expect(page.locator('[data-testid="medium-card"]')).toHaveCount(
      /* TODO: seed via callZome — seededData.mediumsOfExchange.length */null
    );

    // Test medium relationships with offers and requests
    for (const medium of /* TODO: seed via callZome — seededData.mediumsOfExchange.slice(0, 3)) { */null
      // Check offers using this medium
      const offersWithMedium = /* TODO: seed via callZome — seededData.offers.filter((offer) => */null
        offer.mediumOfExchangeHashes.includes(medium.actionHash)
      );

      // Check requests using this medium
      const requestsWithMedium = /* TODO: seed via callZome — seededData.requests.filter((request) => */null
        request.mediumOfExchangeHashes.includes(medium.actionHash)
      );

      // Navigate to offers and filter by this medium
      await gotoApp(page, '/offers');

      if (await page.locator('[data-testid="filter-by-medium"]').isVisible()) {
        await page.click('[data-testid="filter-by-medium"]');
        await page.check(`[data-testid="medium-filter-${medium.actionHash}"]`);
        await page.click('[data-testid="apply-filters"]');

        if (offersWithMedium.length > 0) {
          await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(
            offersWithMedium.length
          );
        }
      }
    }
  });

  test('Offers have complete and valid data with proper relationships', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to offers page
    await gotoApp(page, '/offers');

    // Verify all offers are displayed
    await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(/* TODO: seed via callZome — seededData.offers.length) */null;

    // Validate offers data integrity
    for (const offer of /* TODO: seed via callZome — seededData.offers.slice(0, 5)) { */null
      // Test first 5 offers
      // Verify offer has required fields
      expect(offer.data.title).toBeTruthy();
      expect(offer.data.description).toBeTruthy();
      expect(offer.actionHash).toBeTruthy();
      expect(Array.isArray(offer.serviceTypeHashes)).toBe(true);
      expect(Array.isArray(offer.mediumOfExchangeHashes)).toBe(true);
      expect(offer.serviceTypeHashes.length).toBeGreaterThan(0);
      expect(offer.mediumOfExchangeHashes.length).toBeGreaterThan(0);

      // Navigate to offer details
      await page.goto(`/offers/${offer.actionHash}`);
      await expect(page.locator('[data-testid="offer-details"]')).toBeVisible();
      await expect(page.locator(`text=${offer.data.title}`)).toBeVisible();

      // Verify all linked service types exist and are valid
      for (const serviceTypeHash of offer.serviceTypeHashes) {
        const serviceType = /* TODO: seed via callZome — seededData.serviceTypes.find((st) => st.actionHash === serviceTypeHash) */null;
        expect(serviceType).toBeDefined();

        if (serviceType) {
          await expect(page.locator(`text=${serviceType.data.name}`)).toBeVisible();
        }
      }

      // Verify all linked mediums exist and are valid
      for (const mediumHash of offer.mediumOfExchangeHashes) {
        const medium = /* TODO: seed via callZome — seededData.mediumsOfExchange.find((me) => me.actionHash === mediumHash) */null;
        expect(medium).toBeDefined();

        if (medium) {
          await expect(page.locator(`text=${medium.data.name}`)).toBeVisible();
        }
      }

      // Verify offer author exists
      const authorPubKey = offer.record.signed_action.hashed.content.author;
      const author = [.../* TODO: seed via callZome — seededData.users, ...seededData.adminUsers].find( */null
        (user) => user.record.signed_action.hashed.content.author === authorPubKey
      );
      expect(author).toBeDefined();
    }
  });

  test('Requests have complete and valid data with proper relationships', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Navigate to requests page
    await gotoApp(page, '/requests');

    // Verify all requests are displayed
    await expect(page.locator('[data-testid="request-card"]')).toHaveCount(
      /* TODO: seed via callZome — seededData.requests.length */null
    );

    // Validate requests data integrity
    for (const request of /* TODO: seed via callZome — seededData.requests.slice(0, 5)) { */null
      // Test first 5 requests
      // Verify request has required fields
      expect(request.data.title).toBeTruthy();
      expect(request.data.description).toBeTruthy();
      expect(request.actionHash).toBeTruthy();
      expect(Array.isArray(request.serviceTypeHashes)).toBe(true);
      expect(Array.isArray(request.mediumOfExchangeHashes)).toBe(true);
      expect(request.serviceTypeHashes.length).toBeGreaterThan(0);
      expect(request.mediumOfExchangeHashes.length).toBeGreaterThan(0);

      // Navigate to request details
      await page.goto(`/requests/${request.actionHash}`);
      await expect(page.locator('[data-testid="request-details"]')).toBeVisible();
      await expect(page.locator(`text=${request.data.title}`)).toBeVisible();

      // Verify all linked service types exist and are valid
      for (const serviceTypeHash of request.serviceTypeHashes) {
        const serviceType = /* TODO: seed via callZome — seededData.serviceTypes.find((st) => st.actionHash === serviceTypeHash) */null;
        expect(serviceType).toBeDefined();

        if (serviceType) {
          await expect(page.locator(`text=${serviceType.data.name}`)).toBeVisible();
        }
      }

      // Verify all linked mediums exist and are valid
      for (const mediumHash of request.mediumOfExchangeHashes) {
        const medium = /* TODO: seed via callZome — seededData.mediumsOfExchange.find((me) => me.actionHash === mediumHash) */null;
        expect(medium).toBeDefined();

        if (medium) {
          await expect(page.locator(`text=${medium.data.name}`)).toBeVisible();
        }
      }

      // Verify request author exists
      const authorPubKey = request.record.signed_action.hashed.content.author;
      const author = [.../* TODO: seed via callZome — seededData.users, ...seededData.adminUsers].find( */null
        (user) => user.record.signed_action.hashed.content.author === authorPubKey
      );
      expect(author).toBeDefined();
    }
  });

  test('Cross-reference validation between all entity types', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Validate that all service type references in offers are valid
    const allServiceTypeHashesInOffers = /* TODO: seed via callZome — seededData.offers.flatMap( */null
      (offer) => offer.serviceTypeHashes
    );
    const uniqueServiceTypeHashes = [...new Set(allServiceTypeHashesInOffers)];

    for (const serviceTypeHash of uniqueServiceTypeHashes) {
      const serviceType = /* TODO: seed via callZome — seededData.serviceTypes.find((st) => st.actionHash === serviceTypeHash) */null;
      expect(serviceType).toBeDefined();
    }

    // Validate that all service type references in requests are valid
    const allServiceTypeHashesInRequests = /* TODO: seed via callZome — seededData.requests.flatMap( */null
      (request) => request.serviceTypeHashes
    );
    const uniqueServiceTypeHashesInRequests = [...new Set(allServiceTypeHashesInRequests)];

    for (const serviceTypeHash of uniqueServiceTypeHashesInRequests) {
      const serviceType = /* TODO: seed via callZome — seededData.serviceTypes.find((st) => st.actionHash === serviceTypeHash) */null;
      expect(serviceType).toBeDefined();
    }

    // Validate that all medium references in offers are valid
    const allMediumHashesInOffers = /* TODO: seed via callZome — seededData.offers.flatMap( */null
      (offer) => offer.mediumOfExchangeHashes
    );
    const uniqueMediumHashes = [...new Set(allMediumHashesInOffers)];

    for (const mediumHash of uniqueMediumHashes) {
      const medium = /* TODO: seed via callZome — seededData.mediumsOfExchange.find((me) => me.actionHash === mediumHash) */null;
      expect(medium).toBeDefined();
    }

    // Validate that all medium references in requests are valid
    const allMediumHashesInRequests = /* TODO: seed via callZome — seededData.requests.flatMap( */null
      (request) => request.mediumOfExchangeHashes
    );
    const uniqueMediumHashesInRequests = [...new Set(allMediumHashesInRequests)];

    for (const mediumHash of uniqueMediumHashesInRequests) {
      const medium = /* TODO: seed via callZome — seededData.mediumsOfExchange.find((me) => me.actionHash === mediumHash) */null;
      expect(medium).toBeDefined();
    }

    // Validate that all authors of offers and requests exist as users
    const allOfferAuthors = /* TODO: seed via callZome — seededData.offers.map( */null
      (offer) => offer.record.signed_action.hashed.content.author
    );
    const allRequestAuthors = /* TODO: seed via callZome — seededData.requests.map( */null
      (request) => request.record.signed_action.hashed.content.author
    );
    const allAuthors = [...new Set([...allOfferAuthors, ...allRequestAuthors])];
    const allUsers = [.../* TODO: seed via callZome — seededData.users, ...seededData.adminUsers] */null;

    for (const authorPubKey of allAuthors) {
      const user = allUsers.find(
        (user) => user.record.signed_action.hashed.content.author === authorPubKey
      );
      expect(user).toBeDefined();
    }
  });

  test('Data consistency after UI operations and state changes', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Test data consistency after filtering operations
    await gotoApp(page, '/offers');

    // Apply multiple filters
    const webDevServiceType = /* TODO: seed via callZome — seededData.serviceTypes.find( */null
      (st) => st.data.name === 'Web Development'
    );
    if (webDevServiceType) {
      await page.click('[data-testid="filter-by-service-type"]');
      await page.check(`[data-testid="service-type-${webDevServiceType.actionHash}"]`);
      await page.click('[data-testid="apply-filters"]');

      // Verify filtered results are consistent
      const filteredOffers = /* TODO: seed via callZome — seededData.offers.filter((offer) => */null
        offer.serviceTypeHashes.includes(webDevServiceType.actionHash)
      );

      if (filteredOffers.length > 0) {
        await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(filteredOffers.length);

        // Verify each displayed offer actually contains the service type
        for (let i = 0; i < Math.min(filteredOffers.length, 3); i++) {
          await page.click(`[data-testid="offer-card"]:nth-child(${i + 1})`);
          await expect(page.locator(`text=${webDevServiceType.data.name}`)).toBeVisible();
          await page.goBack();
        }
      }
    }

    // Test data consistency after search operations
    await gotoApp(page, '/requests');
    await page.fill('[data-testid="search-input"]', 'design');
    await page.press('[data-testid="search-input"]', 'Enter');

    // Verify search results are consistent
    const searchResults = page.locator('[data-testid="request-card"]');
    const searchCount = await searchResults.count();

    if (searchCount > 0) {
      // Verify each result contains the search term
      for (let i = 0; i < Math.min(searchCount, 3); i++) {
        const requestCard = searchResults.nth(i);
        const text = await requestCard.textContent();
        expect(text?.toLowerCase()).toContain('design');
      }
    }

    // Test data consistency after sorting operations
    await gotoApp(page, '/offers');
    await page.selectOption('[data-testid="sort-select"]', 'title-asc');
    await page.waitForTimeout(1000);

    // Verify sorting is applied correctly
    const sortedOffers = page.locator('[data-testid="offer-title"]');
    const sortedCount = await sortedOffers.count();

    if (sortedCount > 1) {
      const firstTitle = await sortedOffers.first().textContent();
      const secondTitle = await sortedOffers.nth(1).textContent();

      // Verify alphabetical order
      expect(firstTitle?.localeCompare(secondTitle || '') || 0).toBeLessThanOrEqual(0);
    }
  });

  test('Validate seeded data volumes and distribution', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Verify expected data volumes match strategy document
    expect(/* TODO: seed via callZome — seededData.users.length).toBeGreaterThanOrEqual(20) */null; // Should be around 25
    expect(/* TODO: seed via callZome — seededData.adminUsers.length).toBeGreaterThanOrEqual(2) */null;
    expect(/* TODO: seed via callZome — seededData.organizations.length).toBeGreaterThanOrEqual(6) */null; // Should be around 8
    expect(/* TODO: seed via callZome — seededData.serviceTypes.length).toBeGreaterThanOrEqual(6) */null; // Should be around 8
    expect(/* TODO: seed via callZome — seededData.mediumsOfExchange.length).toBeGreaterThanOrEqual(6) */null; // Should be around 8
    expect(/* TODO: seed via callZome — seededData.requests.length).toBeGreaterThanOrEqual(10) */null; // Should be around 15
    expect(/* TODO: seed via callZome — seededData.offers.length).toBeGreaterThanOrEqual(15) */null; // Should be around 20

    // Verify role distribution in users
    const creators = /* TODO: seed via callZome — seededData.users.filter((user) => user.data.user_type === 'creator') */null;
    const advocates = /* TODO: seed via callZome — seededData.users.filter((user) => user.data.user_type === 'advocate') */null;

    expect(creators.length).toBeGreaterThan(0);
    expect(advocates.length).toBeGreaterThan(0);

    // Verify geographic diversity
    const locations = /* TODO: seed via callZome — seededData.users.map((user) => user.data.location).filter(Boolean) */null;
    const uniqueLocations = new Set(locations);
    expect(uniqueLocations.size).toBeGreaterThan(5); // Should have diverse locations

    // Verify skill diversity
    const allSkills = /* TODO: seed via callZome — seededData.users.flatMap((user) => user.data.skills || []) */null;
    const uniqueSkills = new Set(allSkills);
    expect(uniqueSkills.size).toBeGreaterThan(10); // Should have diverse skills

    // Verify service type distribution in offers and requests
    const serviceTypesInOffers = new Set(
      /* TODO: seed via callZome — seededData.offers.flatMap((offer) => offer.serviceTypeHashes) */null
    );
    const serviceTypesInRequests = new Set(
      /* TODO: seed via callZome — seededData.requests.flatMap((request) => request.serviceTypeHashes) */null
    );

    expect(serviceTypesInOffers.size).toBeGreaterThan(3); // Multiple service types used
    expect(serviceTypesInRequests.size).toBeGreaterThan(3); // Multiple service types used

    console.log('✅ Data integrity validation completed successfully');
    console.log(
      `📊 Data volumes: ${/* TODO: seed via callZome — seededData.users.length} users, ${seededData.offers.length} offers, ${seededData.requests.length} requests` */null
    );
  });
});
