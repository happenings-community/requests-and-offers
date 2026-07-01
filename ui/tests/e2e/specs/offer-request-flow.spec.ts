import { test, expect } from '@playwright/test';
import { gotoApp, createTestClient, callZome, waitForConnection } from '../utils/e2e-helpers.js';
import type { AppWebsocket, Record as HolochainRecord } from '@holochain/client';

// ============================================================================
// OFFER & REQUEST CREATION FLOW
//
// A single agent seeds its own profile and one approved service type via
// direct zome calls (the fast, reliable path — see user-registration-flow),
// then drives the real UI forms to create an offer and a request and
// confirms both show up in their respective list pages.
//
// New profiles start in "pending" status; creating offers/requests requires
// "accepted" (see ProfileGuard.svelte `canCreate`). Since this agent is the
// first user in the sandbox it auto-registers as network administrator
// (see users_organizations::create_user), so it can accept its own profile.
// ============================================================================

test.describe('Offer and request creation flow', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();

    const userRecord = (await callZome(client, 'users_organizations', 'create_user', {
      name: 'E2E Flow User',
      nickname: 'flow_user',
      bio: 'Seeded for the offer/request e2e flow',
      profile_picture: null,
      user_type: 'advocate',
      skills: ['testing'],
      email: 'flow@example.com',
      phone: null,
      time_zone: 'UTC',
      location: 'Test City'
    })) as HolochainRecord;
    const userHash = userRecord.signed_action.hashed.hash;

    const statusRecord = (await callZome(
      client,
      'administration',
      'get_latest_status_record_for_entity',
      { entity: 'users', entity_original_action_hash: userHash }
    )) as HolochainRecord;
    const statusHash = statusRecord.signed_action.hashed.hash;

    await callZome(client, 'administration', 'update_entity_status', {
      entity: 'users',
      entity_original_action_hash: userHash,
      // Fresh status entry — original and previous are the same hash.
      status_original_action_hash: statusHash,
      status_previous_action_hash: statusHash,
      new_status: { status_type: 'accepted', reason: null, suspended_until: null }
    });

    // Admin-created service types are automatically approved.
    await callZome(client, 'service_types', 'create_service_type', {
      service_type: {
        name: 'E2E Testing',
        description: 'Service type seeded for the offer/request e2e flow',
        technical: true
      }
    });
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('user can create an offer that appears in the offers list', async ({ page }) => {
    await gotoApp(page, '/offers/create');
    await waitForConnection(page);

    const title = `E2E Offer ${Date.now()}`;
    await page.getByPlaceholder('What are you offering?').fill(title);
    await page
      .getByPlaceholder('Describe your offer in detail (Markdown supported)')
      .fill('Created by the offer-request-flow e2e test.');
    await page.locator('label:has-text("E2E Testing") input[type="checkbox"]').check();

    await page.getByRole('button', { name: 'Create Offer' }).click();

    await expect(page).toHaveURL(/\/offers$/, { timeout: 15_000 });
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10_000 });
  });

  test('user can create a request that appears in the requests list', async ({ page }) => {
    await gotoApp(page, '/requests/create');
    await waitForConnection(page);

    const title = `E2E Request ${Date.now()}`;
    await page.getByPlaceholder('Enter request title').fill(title);
    await page
      .getByPlaceholder('Describe your request in detail (Markdown supported)')
      .fill('Created by the offer-request-flow e2e test.');
    await page.locator('label:has-text("E2E Testing") input[type="checkbox"]').check();

    await page.getByRole('button', { name: 'Create Request' }).click();

    await expect(page).toHaveURL(/\/requests$/, { timeout: 15_000 });
    await expect(page.locator(`text=${title}`)).toBeVisible({ timeout: 10_000 });
  });
});
