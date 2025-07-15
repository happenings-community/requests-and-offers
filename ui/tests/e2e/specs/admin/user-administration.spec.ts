import { test, expect } from '@playwright/test';
import { setupGlobalHolochain, cleanupGlobalHolochain } from '../../utils/holochain-setup';
import type { SeededData } from '../../fixtures/holochain-data-seeder';

// ============================================================================
// USER ADMINISTRATION E2E TEST
// ============================================================================

test.describe('User Administration with Real Holochain Data', () => {
  let seededData: SeededData;

  // Setup before all tests in this describe block
  test.beforeAll(async () => {
    console.log('🚀 Setting up Holochain with real data for user administration tests...');
    const setup = await setupGlobalHolochain();
    seededData = setup.seededData;
  });

  // Cleanup after all tests
  test.afterAll(async () => {
    await cleanupGlobalHolochain();
  });

  test('Admin can view all users with comprehensive information', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin users page
    await page.goto('/admin/users');
    await expect(page).toHaveURL('/admin/users');

    // Verify that seeded users are displayed (regular users + admin users)
    const totalUsers = seededData.users.length + seededData.adminUsers.length;
    await expect(page.locator('[data-testid="user-row"]')).toHaveCount(totalUsers, {
      timeout: 15000
    });

    // Verify user information is displayed in the table
    const firstUser = seededData.users[0];
    await expect(page.locator(`text=${firstUser.data.name}`)).toBeVisible();
    await expect(page.locator(`text=${firstUser.data.email}`)).toBeVisible();
    await expect(page.locator(`text=${firstUser.data.user_type}`)).toBeVisible();

    // Verify admin users are clearly marked
    const firstAdmin = seededData.adminUsers[0];
    await expect(page.locator(`text=${firstAdmin.data.name}`)).toBeVisible();
    await expect(page.locator('[data-testid="admin-badge"]')).toBeVisible();
  });

  test('Admin can search and filter users', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin users page
    await page.goto('/admin/users');

    // Test search functionality
    const searchUser = seededData.users[0];
    const searchTerm = searchUser.data.name.split(' ')[0]; // Use first name

    await page.fill('[data-testid="user-search-input"]', searchTerm);
    await page.press('[data-testid="user-search-input"]', 'Enter');

    // Verify search results
    const userRows = page.locator('[data-testid="user-row"]');
    const count = await userRows.count();
    expect(count).toBeGreaterThan(0);

    // Test role filter
    await page.selectOption('[data-testid="role-filter"]', 'creator');

    // Verify filtered results show only creators
    const creatorUsers = seededData.users.filter((user) => user.data.user_type === 'creator');
    if (creatorUsers.length > 0) {
      await expect(page.locator('[data-testid="user-row"]')).toHaveCount(creatorUsers.length);
    }

    // Clear filters
    await page.click('[data-testid="clear-filters"]');

    // Verify all users are shown again
    const totalUsers = seededData.users.length + seededData.adminUsers.length;
    await expect(page.locator('[data-testid="user-row"]')).toHaveCount(totalUsers);
  });

  test('Admin can view detailed user profile and activity', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin users page
    await page.goto('/admin/users');

    // Click on a user to view details
    const testUser = seededData.users[0];
    await page.click(`[data-testid="view-user-${testUser.actionHash}"]`);

    // Verify user details page
    await expect(page.locator('[data-testid="user-admin-details"]')).toBeVisible();
    await expect(page.locator(`text=${testUser.data.name}`)).toBeVisible();
    await expect(page.locator(`text=${testUser.data.email}`)).toBeVisible();

    // Verify user activity section
    await expect(page.locator('[data-testid="user-activity"]')).toBeVisible();

    // Check user's offers and requests
    const userOffers = seededData.offers.filter(
      (offer) =>
        offer.record.signed_action.hashed.content.author ===
        testUser.record.signed_action.hashed.content.author
    );

    const userRequests = seededData.requests.filter(
      (request) =>
        request.record.signed_action.hashed.content.author ===
        testUser.record.signed_action.hashed.content.author
    );

    // Verify activity counts
    await expect(page.locator(`text=${userOffers.length} offers`)).toBeVisible();
    await expect(page.locator(`text=${userRequests.length} requests`)).toBeVisible();
  });

  test('Admin can suspend and unsuspend users', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin users page
    await page.goto('/admin/users');

    // Select a regular user (not admin) for suspension
    const testUser = seededData.users[0];
    await page.click(`[data-testid="user-actions-${testUser.actionHash}"]`);

    // Click suspend user
    await page.click('[data-testid="suspend-user"]');

    // Provide suspension reason
    await page.fill(
      '[data-testid="suspension-reason"]',
      'E2E test suspension - inappropriate behavior'
    );

    // Set suspension duration
    await page.selectOption('[data-testid="suspension-duration"]', '7'); // 7 days

    // Confirm suspension
    await page.click('[data-testid="confirm-suspension"]');

    // Wait for suspension to complete
    await expect(page.locator('text=User suspended successfully')).toBeVisible({ timeout: 15000 });

    // Verify user status is updated
    await expect(page.locator('[data-testid="user-status-suspended"]')).toBeVisible();

    // Test unsuspension
    await page.click(`[data-testid="user-actions-${testUser.actionHash}"]`);
    await page.click('[data-testid="unsuspend-user"]');

    // Provide unsuspension reason
    await page.fill(
      '[data-testid="unsuspension-reason"]',
      'E2E test unsuspension - issue resolved'
    );

    // Confirm unsuspension
    await page.click('[data-testid="confirm-unsuspension"]');

    // Wait for unsuspension to complete
    await expect(page.locator('text=User unsuspended successfully')).toBeVisible({
      timeout: 15000
    });

    // Verify user status is updated
    await expect(page.locator('[data-testid="user-status-active"]')).toBeVisible();
  });

  test('Admin can manage user roles and permissions', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin users page
    await page.goto('/admin/users');

    // Select a user for role management
    const testUser = seededData.users[0];
    await page.click(`[data-testid="user-actions-${testUser.actionHash}"]`);

    // Click manage roles
    await page.click('[data-testid="manage-roles"]');

    // Verify role management interface
    await expect(page.locator('[data-testid="role-management"]')).toBeVisible();

    // Test changing user role
    const currentRole = testUser.data.user_type;
    const newRole = currentRole === 'creator' ? 'advocate' : 'creator';

    await page.selectOption('[data-testid="user-role-select"]', newRole);

    // Provide reason for role change
    await page.fill(
      '[data-testid="role-change-reason"]',
      `E2E test role change from ${currentRole} to ${newRole}`
    );

    // Confirm role change
    await page.click('[data-testid="confirm-role-change"]');

    // Wait for role change to complete
    await expect(page.locator('text=User role updated successfully')).toBeVisible({
      timeout: 15000
    });

    // Verify role is updated in the user list
    await expect(page.locator(`text=${newRole}`)).toBeVisible();
  });

  test('Admin can promote users to moderator status', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin users page
    await page.goto('/admin/users');

    // Select a trusted user for promotion
    const testUser = seededData.users[0];
    await page.click(`[data-testid="user-actions-${testUser.actionHash}"]`);

    // Click promote to moderator
    await page.click('[data-testid="promote-moderator"]');

    // Verify promotion confirmation dialog
    await expect(page.locator('[data-testid="promotion-confirmation"]')).toBeVisible();

    // Provide justification for promotion
    await page.fill(
      '[data-testid="promotion-justification"]',
      'E2E test promotion - user has shown excellent community engagement'
    );

    // Confirm promotion
    await page.click('[data-testid="confirm-promotion"]');

    // Wait for promotion to complete
    await expect(page.locator('text=User promoted to moderator')).toBeVisible({ timeout: 15000 });

    // Verify moderator badge is displayed
    await expect(page.locator('[data-testid="moderator-badge"]')).toBeVisible();
  });

  test('Admin can view user reports and moderation history', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin users page
    await page.goto('/admin/users');

    // Click on moderation reports tab
    await page.click('[data-testid="moderation-reports-tab"]');

    // Verify reports interface
    await expect(page.locator('[data-testid="moderation-reports"]')).toBeVisible();

    // Check if there are any reports (might be empty in test environment)
    const reportsExist = await page.locator('[data-testid="report-item"]').isVisible();

    if (reportsExist) {
      // Click on first report
      await page.click('[data-testid="report-item"]:first-child');

      // Verify report details
      await expect(page.locator('[data-testid="report-details"]')).toBeVisible();

      // Test report resolution
      await page.click('[data-testid="resolve-report"]');
      await page.fill('[data-testid="resolution-notes"]', 'E2E test resolution - issue addressed');
      await page.click('[data-testid="confirm-resolution"]');

      // Wait for resolution to complete
      await expect(page.locator('text=Report resolved')).toBeVisible({ timeout: 15000 });
    } else {
      // No reports - verify empty state
      await expect(page.locator('[data-testid="no-reports-message"]')).toBeVisible();
    }
  });

  test('Admin can export user data and generate reports', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin users page
    await page.goto('/admin/users');

    // Click on reports and exports section
    await page.click('[data-testid="reports-exports-tab"]');

    // Verify reports interface
    await expect(page.locator('[data-testid="reports-exports"]')).toBeVisible();

    // Test user activity report generation
    await page.click('[data-testid="generate-activity-report"]');

    // Set report parameters
    await page.selectOption('[data-testid="report-timeframe"]', '30'); // Last 30 days
    await page.check('[data-testid="include-offers"]');
    await page.check('[data-testid="include-requests"]');

    // Generate report
    await page.click('[data-testid="generate-report"]');

    // Wait for report generation
    await expect(page.locator('text=Report generated successfully')).toBeVisible({
      timeout: 20000
    });

    // Verify download link is available
    await expect(page.locator('[data-testid="download-report"]')).toBeVisible();
  });

  test('Admin can bulk manage users', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=Connecting to Holochain...')).toBeHidden({ timeout: 10000 });

    // Navigate to admin users page
    await page.goto('/admin/users');

    // Enable bulk selection
    await page.click('[data-testid="bulk-selection-toggle"]');

    // Select multiple users (avoid selecting admin users)
    await page.check('[data-testid="select-user"]:nth-child(1)');
    await page.check('[data-testid="select-user"]:nth-child(2)');

    // Verify bulk actions menu appears
    await expect(page.locator('[data-testid="bulk-actions-menu"]')).toBeVisible();

    // Test bulk email notification
    await page.click('[data-testid="bulk-send-notification"]');

    // Fill notification details
    await page.fill('[data-testid="notification-subject"]', 'E2E Test Notification');
    await page.fill(
      '[data-testid="notification-message"]',
      'This is a test notification sent during E2E testing'
    );

    // Send notification
    await page.click('[data-testid="send-notification"]');

    // Wait for notification to be sent
    await expect(page.locator('text=Notification sent successfully')).toBeVisible({
      timeout: 15000
    });
  });
});
