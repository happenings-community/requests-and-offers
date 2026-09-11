import { test, expect } from '@playwright/test';
import { encodeHashToBase64, type AppWebsocket, type Record as HcRecord } from '@holochain/client';
import { gotoApp, createTestClient, ensureAcceptedUser, callZome } from '../utils/e2e-helpers.js';

// ============================================================================
// 09 — EXCHANGES
//
// One agent per run, so this covers what one member sees: their empty
// dashboard, and the author's side of the interest block on a listing they
// own. The two-party handshake, proposal, acceptance, completion and review
// is exercised by the exchanges sweettest and walked by hand on two agents.
// ============================================================================

test.describe.serial('09 — exchanges', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('my exchanges renders its three groups and the empty state', async ({ page }) => {
    await gotoApp(page, '/exchanges');

    await expect(page.getByRole('heading', { name: 'My Exchanges', exact: true })).toBeVisible({
      timeout: 15_000
    });
    for (const group of ['Proposals', 'Active', 'Completed']) {
      await expect(page.getByRole('tab', { name: new RegExp(group) })).toBeVisible();
    }
    await expect(page.getByText('No active exchanges yet.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Browse listings to start one' })).toBeVisible();
  });

  test('the author of a listing sees who is interested, not the interest button', async ({
    page
  }) => {
    // The offers spec archives or removes what it makes, so make one here.
    const created = (await callZome(client, 'offers', 'create_offer', {
      offer: {
        title: 'E2E Exchange Listing',
        description: 'A listing whose author looks for interested members.',
        time_preference: 'NoPreference',
        time_zone: 'Europe/London',
        interaction_type: 'Virtual',
        links: []
      },
      organization: null,
      service_type_hashes: [],
      medium_of_exchange_hashes: []
    })) as HcRecord;
    const hash = encodeHashToBase64(created.signed_action.hashed.hash);
    await gotoApp(page, `/offers/${hash}`);

    await expect(page.getByRole('heading', { name: 'Interested members' })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText('No one has registered interest yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Interested in this offer/ })).toHaveCount(0);
  });
});
