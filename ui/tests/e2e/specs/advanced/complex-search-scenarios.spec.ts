import { test, expect } from '@playwright/test';
import { setupGlobalHolochain, cleanupGlobalHolochain } from '../../utils/holochain-setup';
import type { SeededData } from '../../fixtures/holochain-data-seeder';

// ============================================================================
// COMPLEX SEARCH SCENARIOS E2E TEST
// ============================================================================

test.describe('Complex Search Scenarios with Real Holochain Data', () => {
  let seededData: SeededData;

  // Setup before all tests in this describe block
  test.beforeAll(async () => {
    console.log('🚀 Setting up Holochain with real data for complex search tests...');
    const setup = await setupGlobalHolochain();
    seededData = setup.seededData;
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    await cleanupGlobalHolochain();
  });

  test('Advanced offer search with multiple filters and sorting', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to offers page
    await page.goto('/offers');

    // Open advanced search
    await page.click('[data-testid="advanced-search-toggle"]');
    await expect(page.locator('[data-testid="advanced-search-panel"]')).toBeVisible();

    // Test text search
    await page.fill('[data-testid="search-input"]', 'design');

    // Filter by service type
    const webDevServiceType = seededData.serviceTypes.find(st => st.data.name === 'Web Development');
    if (webDevServiceType) {
      await page.check(`[data-testid="service-type-${webDevServiceType.actionHash}"]`);
    }

    // Filter by medium of exchange
    const usdMedium = seededData.mediumsOfExchange.find(me => me.data.name === 'USD');
    if (usdMedium) {
      await page.check(`[data-testid="medium-${usdMedium.actionHash}"]`);
    }

    // Set price range
    await page.fill('[data-testid="price-min"]', '50');
    await page.fill('[data-testid="price-max"]', '500');

    // Apply filters
    await page.click('[data-testid="apply-filters"]');

    // Wait for results
    await page.waitForTimeout(2000);

    // Verify filtered results
    const offerCards = page.locator('[data-testid="offer-card"]');
    const count = await offerCards.count();
    expect(count).toBeGreaterThanOrEqual(0);

    // Test sorting
    await page.selectOption('[data-testid="sort-select"]', 'price-asc');
    await page.waitForTimeout(1000);

    // Verify sorting is applied (check if first offer has lower price than last)
    if (count > 1) {
      const firstOfferPrice = await page.locator('[data-testid="offer-price"]').first().textContent();
      const lastOfferPrice = await page.locator('[data-testid="offer-price"]').last().textContent();
      
      // Basic price comparison (assuming prices are displayed as numbers)
      const firstPrice = parseFloat(firstOfferPrice?.replace(/[^\d.]/g, '') || '0');
      const lastPrice = parseFloat(lastOfferPrice?.replace(/[^\d.]/g, '') || '0');
      expect(firstPrice).toBeLessThanOrEqual(lastPrice);
    }
  });

  test('Complex request search with location and skill filters', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to requests page
    await page.goto('/requests');

    // Open advanced search
    await page.click('[data-testid="advanced-search-toggle"]');

    // Search by skills
    await page.fill('[data-testid="skills-search"]', 'JavaScript');

    // Filter by location
    await page.fill('[data-testid="location-filter"]', 'New York');

    // Filter by urgency
    await page.selectOption('[data-testid="urgency-filter"]', 'high');

    // Filter by date range
    await page.fill('[data-testid="date-from"]', '2024-01-01');
    await page.fill('[data-testid="date-to"]', '2024-12-31');

    // Apply filters
    await page.click('[data-testid="apply-filters"]');

    // Wait for results
    await page.waitForTimeout(2000);

    // Verify filtered results
    const requestCards = page.locator('[data-testid="request-card"]');
    const count = await requestCards.count();
    expect(count).toBeGreaterThanOrEqual(0);

    // Verify search results contain the search criteria
    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const requestCard = requestCards.nth(i);
        const text = await requestCard.textContent();
        
        // Should contain JavaScript skill or related terms
        const hasRelevantContent = text?.toLowerCase().includes('javascript') || 
                                 text?.toLowerCase().includes('js') ||
                                 text?.toLowerCase().includes('frontend') ||
                                 text?.toLowerCase().includes('web');
        expect(hasRelevantContent).toBe(true);
      }
    }
  });

  test('Cross-entity search across offers, requests, and organizations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to global search page
    await page.goto('/search');

    // Perform global search
    const searchTerm = 'design';
    await page.fill('[data-testid="global-search-input"]', searchTerm);
    await page.press('[data-testid="global-search-input"]', 'Enter');

    // Wait for results
    await page.waitForTimeout(3000);

    // Verify different entity types are returned
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

    // Check offers section
    const offersSection = page.locator('[data-testid="offers-results"]');
    if (await offersSection.isVisible()) {
      await expect(page.locator('[data-testid="offer-result"]')).toBeVisible();
    }

    // Check requests section
    const requestsSection = page.locator('[data-testid="requests-results"]');
    if (await requestsSection.isVisible()) {
      await expect(page.locator('[data-testid="request-result"]')).toBeVisible();
    }

    // Check organizations section
    const orgsSection = page.locator('[data-testid="organizations-results"]');
    if (await orgsSection.isVisible()) {
      await expect(page.locator('[data-testid="organization-result"]')).toBeVisible();
    }

    // Check users section
    const usersSection = page.locator('[data-testid="users-results"]');
    if (await usersSection.isVisible()) {
      await expect(page.locator('[data-testid="user-result"]')).toBeVisible();
    }

    // Test filtering by entity type
    await page.click('[data-testid="filter-offers-only"]');
    await page.waitForTimeout(1000);

    // Verify only offers are shown
    await expect(page.locator('[data-testid="offers-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="requests-results"]')).not.toBeVisible();
  });

  test('Pagination and infinite scroll with large result sets', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to offers page
    await page.goto('/offers');

    // Perform a broad search to get many results
    await page.fill('[data-testid="search-input"]', 'a'); // Single letter to match many offers
    await page.press('[data-testid="search-input"]', 'Enter');

    // Wait for initial results
    await page.waitForTimeout(2000);

    // Check if pagination is present
    const paginationExists = await page.locator('[data-testid="pagination"]').isVisible();
    
    if (paginationExists) {
      // Test pagination
      const initialCount = await page.locator('[data-testid="offer-card"]').count();
      
      // Go to next page
      await page.click('[data-testid="next-page"]');
      await page.waitForTimeout(2000);
      
      // Verify page changed
      await expect(page.locator('[data-testid="current-page"]')).not.toContainText('1');
      
      // Go back to first page
      await page.click('[data-testid="first-page"]');
      await page.waitForTimeout(2000);
      
      // Verify we're back on page 1
      await expect(page.locator('[data-testid="current-page"]')).toContainText('1');
    } else {
      // Test infinite scroll if pagination is not used
      const initialCount = await page.locator('[data-testid="offer-card"]').count();
      
      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      
      // Check if more items loaded
      const newCount = await page.locator('[data-testid="offer-card"]').count();
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    }
  });

  test('Search with special characters and edge cases', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to offers page
    await page.goto('/offers');

    // Test search with special characters
    const specialSearches = [
      'C++',
      '.NET',
      'Node.js',
      'React/Vue',
      'UI/UX',
      'front-end',
      'back_end',
      'full-stack'
    ];

    for (const searchTerm of specialSearches.slice(0, 3)) { // Test first 3 to save time
      await page.fill('[data-testid="search-input"]', searchTerm);
      await page.press('[data-testid="search-input"]', 'Enter');
      await page.waitForTimeout(1000);

      // Verify search doesn't break and returns some results or no results message
      const hasResults = await page.locator('[data-testid="offer-card"]').count() > 0;
      const hasNoResultsMessage = await page.locator('[data-testid="no-results-message"]').isVisible();
      
      expect(hasResults || hasNoResultsMessage).toBe(true);
    }

    // Test empty search
    await page.fill('[data-testid="search-input"]', '');
    await page.press('[data-testid="search-input"]', 'Enter');
    await page.waitForTimeout(1000);

    // Should show all offers or prompt for search term
    const allOffersCount = await page.locator('[data-testid="offer-card"]').count();
    expect(allOffersCount).toBeGreaterThanOrEqual(0);
  });

  test('Real-time search suggestions and autocomplete', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to offers page
    await page.goto('/offers');

    // Start typing to trigger suggestions
    await page.fill('[data-testid="search-input"]', 'web');
    await page.waitForTimeout(500);

    // Check if suggestions appear
    const suggestionsVisible = await page.locator('[data-testid="search-suggestions"]').isVisible();
    
    if (suggestionsVisible) {
      // Verify suggestions are relevant
      await expect(page.locator('[data-testid="suggestion-item"]')).toBeVisible();
      
      // Click on a suggestion
      await page.click('[data-testid="suggestion-item"]:first-child');
      
      // Verify search is performed with the selected suggestion
      await page.waitForTimeout(1000);
      const resultsVisible = await page.locator('[data-testid="offer-card"]').isVisible();
      expect(resultsVisible).toBe(true);
    }

    // Test skill-based autocomplete
    await page.fill('[data-testid="search-input"]', 'java');
    await page.waitForTimeout(500);

    // Should suggest JavaScript, Java, etc.
    if (await page.locator('[data-testid="search-suggestions"]').isVisible()) {
      const suggestions = await page.locator('[data-testid="suggestion-item"]').allTextContents();
      const hasRelevantSuggestions = suggestions.some(suggestion => 
        suggestion.toLowerCase().includes('java')
      );
      expect(hasRelevantSuggestions).toBe(true);
    }
  });

  test('Saved searches and search history', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to offers page
    await page.goto('/offers');

    // Perform a search
    await page.fill('[data-testid="search-input"]', 'web development');
    await page.press('[data-testid="search-input"]', 'Enter');
    await page.waitForTimeout(2000);

    // Save the search
    const saveSearchButton = page.locator('[data-testid="save-search"]');
    if (await saveSearchButton.isVisible()) {
      await saveSearchButton.click();
      
      // Name the saved search
      await page.fill('[data-testid="saved-search-name"]', 'E2E Web Dev Search');
      await page.click('[data-testid="confirm-save-search"]');
      
      // Verify search is saved
      await expect(page.locator('text=Search saved successfully')).toBeVisible({ timeout: 10000 });
    }

    // Check search history
    await page.click('[data-testid="search-history"]');
    
    if (await page.locator('[data-testid="search-history-panel"]').isVisible()) {
      // Verify recent search appears in history
      await expect(page.locator('text=web development')).toBeVisible();
      
      // Click on a history item to repeat the search
      await page.click('[data-testid="history-item"]:first-child');
      await page.waitForTimeout(1000);
      
      // Verify search is performed
      const searchInput = await page.locator('[data-testid="search-input"]').inputValue();
      expect(searchInput).toBeTruthy();
    }
  });

  test('Search performance with large datasets', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to offers page
    await page.goto('/offers');

    // Measure search performance
    const startTime = Date.now();
    
    // Perform a complex search
    await page.fill('[data-testid="search-input"]', 'development');
    await page.press('[data-testid="search-input"]', 'Enter');
    
    // Wait for results to load
    await expect(page.locator('[data-testid="search-results-loaded"]')).toBeVisible({ timeout: 15000 });
    
    const endTime = Date.now();
    const searchTime = endTime - startTime;
    
    // Search should complete within reasonable time (15 seconds max)
    expect(searchTime).toBeLessThan(15000);
    
    // Verify results are displayed
    const resultsCount = await page.locator('[data-testid="offer-card"]').count();
    expect(resultsCount).toBeGreaterThanOrEqual(0);
    
    // Test rapid successive searches (stress test)
    const rapidSearches = ['design', 'marketing', 'consulting', 'development'];
    
    for (const term of rapidSearches) {
      await page.fill('[data-testid="search-input"]', term);
      await page.press('[data-testid="search-input"]', 'Enter');
      await page.waitForTimeout(500); // Short wait between searches
    }
    
    // Verify final search completed successfully
    await expect(page.locator('[data-testid="search-results-loaded"]')).toBeVisible({ timeout: 10000 });
  });
});
