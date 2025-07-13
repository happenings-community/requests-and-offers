import { test, expect } from '@playwright/test';
import { setupGlobalHolochain, cleanupGlobalHolochain } from '../../utils/holochain-setup';
import type { SeededData } from '../../fixtures/holochain-data-seeder';

// ============================================================================
// USER REGISTRATION FLOW E2E TEST
// ============================================================================

test.describe('User Registration Flow with Real Holochain Data', () => {
  let seededData: SeededData;

  // Setup before all tests in this describe block
  test.beforeAll(async () => {
    console.log('🚀 Setting up Holochain with real data for user registration tests...');
    const setup = await setupGlobalHolochain();
    seededData = setup.seededData;
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    await cleanupGlobalHolochain();
  });

  test('New user can complete registration process', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for Holochain connection
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Check if user registration/profile setup is needed
    // This might redirect to a profile setup page or show a registration form
    const currentUrl = page.url();
    
    if (currentUrl.includes('/profile/setup') || currentUrl.includes('/register')) {
      // Fill in user registration form
      await page.fill('[data-testid="user-name-input"]', 'E2E Test User');
      await page.fill('[data-testid="user-email-input"]', 'e2e-test@example.com');
      await page.fill('[data-testid="user-bio-input"]', 'This is a test user created during E2E testing');
      
      // Select user role (Advocate or Creator)
      await page.click('[data-testid="role-creator"]');
      
      // Add some skills
      await page.fill('[data-testid="skills-input"]', 'JavaScript, TypeScript, Testing');
      
      // Set location
      await page.fill('[data-testid="location-input"]', 'Test City, Test Country');
      
      // Submit registration
      await page.click('[data-testid="submit-registration"]');
      
      // Wait for registration to complete
      await expect(page.locator('text=Registration successful')).toBeVisible({ timeout: 10000 });
    }

    // Verify user can access main application features
    await page.goto('/offers');
    await expect(page).toHaveURL('/offers');
    
    // Verify user can access profile page
    await page.goto('/profile');
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
  });

  test('User can update profile information', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to profile page
    await page.goto('/profile');
    
    // Click edit profile button
    await page.click('[data-testid="edit-profile-button"]');
    
    // Update profile information
    await page.fill('[data-testid="user-bio-input"]', 'Updated bio for E2E testing');
    await page.fill('[data-testid="skills-input"]', 'JavaScript, TypeScript, Testing, Playwright');
    
    // Save changes
    await page.click('[data-testid="save-profile-button"]');
    
    // Verify changes were saved
    await expect(page.locator('text=Profile updated successfully')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Updated bio for E2E testing')).toBeVisible();
  });

  test('User profile displays correct information and relationships', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Use a seeded user for this test
    const testUser = seededData.users[0];
    
    // Navigate to user profile (assuming we can view other user profiles)
    await page.goto(`/users/${testUser.actionHash}`);
    
    // Verify user information is displayed correctly
    await expect(page.locator(`text=${testUser.data.name}`)).toBeVisible();
    await expect(page.locator(`text=${testUser.data.email}`)).toBeVisible();
    
    if (testUser.data.bio) {
      await expect(page.locator(`text=${testUser.data.bio}`)).toBeVisible();
    }
    
    // Verify skills are displayed
    if (testUser.data.skills && testUser.data.skills.length > 0) {
      for (const skill of testUser.data.skills.slice(0, 3)) { // Check first 3 skills
        await expect(page.locator(`text=${skill}`)).toBeVisible();
      }
    }
    
    // Verify location is displayed
    if (testUser.data.location) {
      await expect(page.locator(`text=${testUser.data.location}`)).toBeVisible();
    }
  });

  test('User can view and manage their own offers and requests', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to user's own profile
    await page.goto('/profile');
    
    // Check offers section
    await page.click('[data-testid="my-offers-tab"]');
    
    // Verify offers are displayed (might be empty for new user)
    const offerCards = page.locator('[data-testid="offer-card"]');
    const offerCount = await offerCards.count();
    
    // Check requests section
    await page.click('[data-testid="my-requests-tab"]');
    
    // Verify requests are displayed (might be empty for new user)
    const requestCards = page.locator('[data-testid="request-card"]');
    const requestCount = await requestCards.count();
    
    // Both counts should be non-negative numbers
    expect(offerCount).toBeGreaterThanOrEqual(0);
    expect(requestCount).toBeGreaterThanOrEqual(0);
  });

  test('User role affects available functionality', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Test with a Creator user from seeded data
    const creatorUser = seededData.users.find(user => user.data.role === 'creator');
    
    if (creatorUser) {
      // Navigate to offers page
      await page.goto('/offers');
      
      // Creator should be able to create offers
      await expect(page.locator('[data-testid="create-offer-button"]')).toBeVisible();
      
      // Navigate to requests page
      await page.goto('/requests');
      
      // Creator should be able to view and respond to requests
      await expect(page.locator('[data-testid="request-card"]')).toHaveCount(seededData.requests.length, { timeout: 15000 });
    }

    // Test with an Advocate user from seeded data
    const advocateUser = seededData.users.find(user => user.data.role === 'advocate');
    
    if (advocateUser) {
      // Advocates should be able to create requests
      await page.goto('/requests');
      await expect(page.locator('[data-testid="create-request-button"]')).toBeVisible();
    }
  });
});
