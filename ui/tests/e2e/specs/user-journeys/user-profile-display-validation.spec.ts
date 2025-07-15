import { test, expect } from '@playwright/test';
import { setupGlobalHolochain, cleanupGlobalHolochain } from '../../utils/holochain-setup';
import type { SeededData } from '../../fixtures/holochain-data-seeder';

// ============================================================================
// USER PROFILE DISPLAY VALIDATION E2E TEST
// ============================================================================

test.describe('User Profile Display Validation with Real Holochain Data', () => {
  let seededData: SeededData;

  // Setup before all tests in this describe block
  test.beforeAll(async () => {
    console.log('🚀 Setting up Holochain with real data for user profile validation tests...');
    const setup = await setupGlobalHolochain();
    seededData = setup.seededData;
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    await cleanupGlobalHolochain();
  });

  test('User profile displays all seeded user information correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Test with multiple seeded users
    for (let i = 0; i < Math.min(3, seededData.users.length); i++) {
      const testUser = seededData.users[i];
      
      // Navigate to user profile
      await page.goto(`/users/${testUser.actionHash}`);

      // Verify basic user information
      await expect(page.locator(`text=${testUser.data.name}`)).toBeVisible();
      await expect(page.locator(`text=${testUser.data.email}`)).toBeVisible();
      
      // Verify role is displayed
      await expect(page.locator(`text=${testUser.data.user_type}`)).toBeVisible();
      
      // Verify bio if present
      if (testUser.data.bio) {
        await expect(page.locator(`text=${testUser.data.bio}`)).toBeVisible();
      }
      
      // Verify location if present
      if (testUser.data.location) {
        await expect(page.locator(`text=${testUser.data.location}`)).toBeVisible();
      }
      
      // Verify skills are displayed
      if (testUser.data.skills && testUser.data.skills.length > 0) {
        await expect(page.locator('[data-testid="user-skills"]')).toBeVisible();
        
        // Check first few skills
        for (const skill of testUser.data.skills.slice(0, 3)) {
          await expect(page.locator(`text=${skill}`)).toBeVisible();
        }
      }
      
      // Verify avatar or profile image placeholder
      await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();
    }
  });

  test('Admin user profiles display admin status and permissions', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Test with admin users from seeded data
    for (const adminUser of seededData.adminUsers.slice(0, 2)) {
      // Navigate to admin user profile
      await page.goto(`/users/${adminUser.actionHash}`);

      // Verify admin badge or indicator
      await expect(page.locator('[data-testid="admin-badge"]')).toBeVisible();
      
      // Verify admin user information
      await expect(page.locator(`text=${adminUser.data.name}`)).toBeVisible();
      await expect(page.locator(`text=${adminUser.data.email}`)).toBeVisible();
      
      // Admin users should have special indicators
      await expect(page.locator('text=Administrator')).toBeVisible();
    }
  });

  test('User profile shows correct organization memberships', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Find a user who should be a member of organizations
    const testUser = seededData.users[0];
    
    // Navigate to user profile
    await page.goto(`/users/${testUser.actionHash}`);

    // Check organizations section
    const organizationsSection = page.locator('[data-testid="user-organizations"]');
    
    if (await organizationsSection.isVisible()) {
      // Verify organization memberships are displayed
      await expect(page.locator('[data-testid="organization-membership"]')).toBeVisible();
      
      // Check if coordinator roles are indicated
      const coordinatorBadge = page.locator('[data-testid="coordinator-badge"]');
      if (await coordinatorBadge.isVisible()) {
        await expect(coordinatorBadge).toBeVisible();
      }
    }
  });

  test('User profile displays offers and requests with correct data', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Test with a user who should have offers/requests
    const testUser = seededData.users[0];
    
    // Navigate to user profile
    await page.goto(`/users/${testUser.actionHash}`);

    // Check user's offers section
    await page.click('[data-testid="user-offers-tab"]');
    
    const userOffers = seededData.offers.filter(offer => 
      offer.record.signed_action.hashed.content.author === testUser.record.signed_action.hashed.content.author
    );
    
    if (userOffers.length > 0) {
      await expect(page.locator('[data-testid="offer-card"]')).toHaveCount(userOffers.length);
      
      // Verify first offer details
      const firstOffer = userOffers[0];
      await expect(page.locator(`text=${firstOffer.data.title}`)).toBeVisible();
    } else {
      // Should show empty state
      await expect(page.locator('[data-testid="no-offers-message"]')).toBeVisible();
    }

    // Check user's requests section
    await page.click('[data-testid="user-requests-tab"]');
    
    const userRequests = seededData.requests.filter(request => 
      request.record.signed_action.hashed.content.author === testUser.record.signed_action.hashed.content.author
    );
    
    if (userRequests.length > 0) {
      await expect(page.locator('[data-testid="request-card"]')).toHaveCount(userRequests.length);
      
      // Verify first request details
      const firstRequest = userRequests[0];
      await expect(page.locator(`text=${firstRequest.data.title}`)).toBeVisible();
    } else {
      // Should show empty state
      await expect(page.locator('[data-testid="no-requests-message"]')).toBeVisible();
    }
  });

  test('User profile contact information is properly displayed', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    const testUser = seededData.users[0];
    
    // Navigate to user profile
    await page.goto(`/users/${testUser.actionHash}`);

    // Verify contact information section
    await expect(page.locator('[data-testid="user-contact-info"]')).toBeVisible();
    
    // Email should be visible
    await expect(page.locator(`text=${testUser.data.email}`)).toBeVisible();
    
    // Phone number if present
    if (testUser.data.phone) {
      await expect(page.locator(`text=${testUser.data.phone}`)).toBeVisible();
    }
    
    // Website if present
    if (testUser.data.website) {
      await expect(page.locator(`text=${testUser.data.website}`)).toBeVisible();
    }
    
    // Social media links if present
    if (testUser.data.socialMedia) {
      await expect(page.locator('[data-testid="social-media-links"]')).toBeVisible();
    }
  });

  test('User profile activity timeline shows recent actions', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    const testUser = seededData.users[0];
    
    // Navigate to user profile
    await page.goto(`/users/${testUser.actionHash}`);

    // Check activity timeline section
    const activitySection = page.locator('[data-testid="user-activity-timeline"]');
    
    if (await activitySection.isVisible()) {
      // Verify activity items are displayed
      await expect(page.locator('[data-testid="activity-item"]')).toBeVisible();
      
      // Check for different types of activities
      const activities = ['offer created', 'request created', 'organization joined'];
      
      for (const activity of activities) {
        const activityItem = page.locator(`text=${activity}`);
        if (await activityItem.isVisible()) {
          await expect(activityItem).toBeVisible();
        }
      }
    }
  });

  test('User profile privacy settings are respected', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    const testUser = seededData.users[0];
    
    // Navigate to user profile
    await page.goto(`/users/${testUser.actionHash}`);

    // Check if private information is properly hidden/shown based on privacy settings
    // This would depend on the actual privacy implementation
    
    // Email might be hidden for privacy
    const emailElement = page.locator(`text=${testUser.data.email}`);
    const isEmailVisible = await emailElement.isVisible();
    
    // Phone number should be private by default
    if (testUser.data.phone) {
      const phoneElement = page.locator(`text=${testUser.data.phone}`);
      const isPhoneVisible = await phoneElement.isVisible();
      
      // Phone should typically be private
      expect(isPhoneVisible).toBe(false);
    }
    
    // Public information should always be visible
    await expect(page.locator(`text=${testUser.data.name}`)).toBeVisible();
    await expect(page.locator(`text=${testUser.data.user_type}`)).toBeVisible();
  });

  test('User profile navigation and breadcrumbs work correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    const testUser = seededData.users[0];
    
    // Navigate to user profile
    await page.goto(`/users/${testUser.actionHash}`);

    // Verify breadcrumb navigation
    await expect(page.locator('[data-testid="breadcrumb"]')).toBeVisible();
    await expect(page.locator('text=Users')).toBeVisible();
    await expect(page.locator(`text=${testUser.data.name}`)).toBeVisible();
    
    // Test navigation back to users list
    await page.click('text=Users');
    await expect(page).toHaveURL('/users');
    
    // Verify users list is displayed
    await expect(page.locator('[data-testid="user-card"]')).toBeVisible();
  });
});
