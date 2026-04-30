import { test, expect } from '@playwright/test';
import { gotoApp, createTestClient, callZome, waitForConnection } from '../../utils/e2e-helpers.js';
import type { AppWebsocket } from '@holochain/client';

// ============================================================================
// USER REGISTRATION FLOW
// Tests the full browser↔conductor path: the same token that opens the
// AppWebsocket in the browser is used by createTestClient(), so both share
// the same Holochain agent identity. Data seeded here appears in the UI
// immediately without waiting for DHT gossip.
// ============================================================================

test.describe('User registration flow', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('app loads and connects to conductor', async ({ page }) => {
    await gotoApp(page, '/');

    // The page should not be stuck on a connection error
    await expect(page.locator('text=Failed to connect')).toBeHidden({ timeout: 15_000 });
    await expect(page).toHaveURL(/localhost:\d+/);
  });

  test('new user is redirected to profile setup', async ({ page }) => {
    // A fresh conductor has no profile → the UI should redirect or show a setup prompt
    await gotoApp(page, '/');
    await waitForConnection(page);

    // Accept either a redirect to a setup page or a setup component on the home page
    const isOnSetup =
      page.url().includes('/profile/setup') ||
      page.url().includes('/register') ||
      (await page.locator('[data-testid="user-profile-setup"]').isVisible());

    expect(isOnSetup).toBe(true);
  });

  test('user can create a profile via zome call (seed) then see it in the UI', async ({ page }) => {
    // Seed a profile directly through the conductor using our test client.
    // The browser connects with the same agent key, so it sees the profile immediately.
    const profileInput = {
      name: 'E2E Test User',
      nickname: 'e2e_tester',
      bio: 'Created during automated e2e testing',
      profile_picture: null,
      user_type: 'advocate',
      skills: ['testing', 'playwright'],
      email: 'e2e@example.com',
      phone: null,
      time_zone: 'UTC',
      location: 'Test City',
    };

    await callZome(client, 'users_organizations', 'create_user', profileInput);

    // Navigate to profile page — conductor already has the data
    await gotoApp(page, '/profile');
    await waitForConnection(page);

    await expect(page.locator(`text=${profileInput.name}`)).toBeVisible({ timeout: 10_000 });
  });

  test('offers page is accessible after profile exists', async ({ page }) => {
    await gotoApp(page, '/offers');
    await waitForConnection(page);

    // Should render something — either a list or an empty state, not an error
    await expect(page.locator('[data-testid="offers-page"], text=No offers')).toBeVisible({
      timeout: 10_000,
    });
  });
});
