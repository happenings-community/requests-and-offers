import { test, expect } from '@playwright/test';
import { setupDesktopTest } from '../../utils/setup-desktop';
import { testUsers } from '../../fixtures/users';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupDesktopTest({ page });
  });

  test('should create new user profile', async ({ page }) => {
    // Navigate to create user page
    await page.goto('/user/create');
    await page.waitForLoadState('networkidle');

    // Wait for form to be visible
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Fill in user creation form
    await page.locator('input[name="name"]').fill('New User');
    await page.locator('input[name="nickname"]').fill('newuser');
    await page.locator('input[name="email"]').fill('new@test.com');
    await page.locator('select[name="user_type"]').selectOption('advocate');

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Wait for navigation
    await page.waitForURL('/users');

    // Verify user is added to table
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });
    await expect(page.locator('table tbody tr').filter({ hasText: 'New User' })).toBeVisible();
  });

  test('should edit user profile', async ({ page }) => {
    // Navigate to user profile
    await page.goto('/user/profile');
    await page.waitForLoadState('networkidle');

    // Wait for form to be visible
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });

    // Update profile information
    await page.locator('textarea[name="bio"]').fill('Updated bio');
    await page.locator('input[name="location"]').fill('New Location');
    await page.locator('button[type="submit"]').click();

    // Verify changes are saved
    await page.waitForSelector('form', { state: 'visible', timeout: 10000 });
    await expect(page.locator('textarea[name="bio"]')).toHaveValue('Updated bio');
    await expect(page.locator('input[name="location"]')).toHaveValue('New Location');
  });

  test('should display user information', async ({ page }) => {
    // Navigate to users page
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    // Wait for store initialization
    await page.waitForFunction(
      () => {
        const store = window.__USERS_STORE__;
        return store && store.acceptedUsers.length > 0;
      },
      { timeout: 10000 }
    );

    // Wait for table to be visible
    await page.waitForSelector('table', { state: 'visible', timeout: 10000 });

    // Check if user information is displayed in the table
    const adminUser = testUsers.admin;
    await expect(page.locator('table tbody tr').filter({ hasText: adminUser.name })).toBeVisible();
    await expect(
      page.locator('table tbody tr').filter({ hasText: adminUser.user_type })
    ).toBeVisible();
  });
});
