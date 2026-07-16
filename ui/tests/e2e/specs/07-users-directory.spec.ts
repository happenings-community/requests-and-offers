import { test, expect } from '@playwright/test';
import type { AppWebsocket } from '@holochain/client';
import { gotoApp, createTestClient, ensureAcceptedUser } from '../utils/e2e-helpers.js';

// ============================================================================
// 07 — USERS DIRECTORY
//
// The public community directory: the accepted member is listed on /users
// and their public profile page renders. With one agent per run the
// directory has exactly one member — multi-user rendering is unit/Sweettest
// territory.
// ============================================================================

test.describe.serial('07 — users directory', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('users page lists the community member', async ({ page }) => {
    await gotoApp(page, '/users');

    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole('button', { name: 'View Profile' }).first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('public profile page renders the member profile', async ({ page }) => {
    await gotoApp(page, '/users');
    await page.getByRole('button', { name: 'View Profile' }).first().click();

    await expect(page).toHaveURL(/\/users\/[^/]+$/, { timeout: 15_000 });
    await expect(page.locator('text=e2e_tester').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Status :').first()).toBeVisible();
  });
});
