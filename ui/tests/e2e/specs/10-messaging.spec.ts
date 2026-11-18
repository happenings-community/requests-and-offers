import { test, expect } from '@playwright/test';
import type { AppWebsocket } from '@holochain/client';
import {
  gotoApp,
  createTestClient,
  closeTestClient,
  ensureAcceptedUser
} from '../utils/e2e-helpers.js';

// ============================================================================
// 10 — MESSAGING
//
// One agent per run, so this covers what one member sees on their own: My
// Messages in the Profile menu, the Messages page with no conversations, and the
// Blocked members page with nobody on it. All three go red on a network that has
// lost its messaging zome (the pages show a notice instead) or on a missing route.
// The second also depends on reading the zome: "No conversations yet" shows only
// once the conversations have been read; a failed read shows its reason instead.
// Blocked members is read from the device, not the zome.
//
// A conversation needs a second member. Sending, reading, cards and blocks between
// two people are exercised by the messaging Sweettests (`messaging`,
// `messaging_inbox`, `messaging_roles`) and walked by hand on two agents; the
// two-agent spec is #461.
// ============================================================================

test.describe.serial('10 — messaging', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
  });

  test.afterAll(async () => {
    await closeTestClient(client);
  });

  test('My Messages is in the Profile menu and opens Messages', async ({ page }) => {
    await gotoApp(page, '/');
    // The menu opens on hover; its button is named "Profile menu", with a count after
    // it when something is new.
    await page
      .getByRole('navigation')
      .getByRole('button', { name: /^Profile menu/ })
      .hover();
    await page.getByRole('menuitem', { name: /My Messages/ }).click();

    await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible({
      timeout: 15_000
    });
    await expect(page).toHaveURL(/\/messages(\?|$)/);
  });

  test('Messages says there are no conversations yet, rather than nothing', async ({ page }) => {
    await gotoApp(page, '/messages');

    await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible({
      timeout: 15_000
    });
    // The empty state shows only once the conversations have been read: a read that
    // failed shows its reason and Try again instead, never this.
    await expect(page.getByRole('heading', { name: 'No conversations yet' })).toBeVisible({
      timeout: 15_000
    });
  });

  test('Blocked members opens with nobody on it', async ({ page }) => {
    await gotoApp(page, '/messages');
    await page.getByRole('link', { name: 'Blocked members' }).click();

    await expect(page.getByRole('heading', { name: 'Blocked members', level: 1 })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText("You haven't blocked anyone.")).toBeVisible();
  });
});
