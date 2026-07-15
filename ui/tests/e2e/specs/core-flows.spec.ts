import { test, expect } from '@playwright/test';
import { gotoApp, createTestClient, callZome, waitForConnection } from '../utils/e2e-helpers.js';
import type { AppWebsocket, Record as HolochainRecord } from '@holochain/client';

// ============================================================================
// CORE E2E FLOW
//
// global-setup starts exactly ONE conductor for the whole Playwright run
// (see tests/setup/global-setup.ts), so every spec file shares the same
// agent identity. users_organizations::create_user rejects a second call
// for an already-registered agent (UsersError::UserAlreadyExists), which
// means "one agent creates its profile" can only happen once per run.
//
// Rather than fight that with per-file idempotency checks, this single file
// drives the whole story end to end, in order:
//   1. connect and see the "create a profile" call to action
//   2. create a profile via a direct zome call and see it in the UI
//   3. accept that profile (the agent auto-registered as network
//      administrator by being the first user — see
//      users_organizations::create_user) so it can create offers/requests
//   4. seed a service type and a medium of exchange as admin and confirm
//      both list on their admin pages
//   5. create an offer and a request through the real UI forms and confirm
//      both show up in their list pages
//
// test.describe.serial: later tests depend on state set up by earlier ones,
// so a failure should skip the rest of the file rather than cascade.
// ============================================================================

test.describe.serial('Requests & Offers core flow', () => {
  let client: AppWebsocket;
  let userHash: Uint8Array;

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

  test('home page invites a new user to create a profile', async ({ page }) => {
    await gotoApp(page, '/');
    await waitForConnection(page);

    // A fresh conductor has no profile — the home page shows a "Create
    // Profile" call to action rather than redirecting anywhere.
    await expect(page.getByRole('link', { name: /Create Profile/i })).toBeVisible();
  });

  test('user can create a profile via zome call and see it in the UI', async ({ page }) => {
    // Seed a profile directly through the conductor using our test client.
    // The browser connects with the same agent key, so it sees the profile immediately.
    const userRecord = (await callZome(client, 'users_organizations', 'create_user', {
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
    })) as HolochainRecord;
    userHash = userRecord.signed_action.hashed.hash;

    // Navigate to the own-profile page — conductor already has the data
    await gotoApp(page, '/user');
    await waitForConnection(page);

    await expect(page.locator('text=E2E Test User')).toBeVisible({ timeout: 10_000 });
  });

  test('agent accepts its own profile as network administrator', async ({ page }) => {
    // New profiles start "pending"; creating offers/requests requires
    // "accepted" (see ProfileGuard.svelte). Being the first user in the
    // sandbox, this agent auto-registered as network administrator (see
    // users_organizations::create_user), so it can accept its own profile.
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
      new_status: { status_type: 'accepted', reason: null, suspended_until: null },
    });

    await gotoApp(page, '/offers');
    await waitForConnection(page);

    // The "Create Offer" button only renders once the profile is accepted.
    await expect(page.getByRole('button', { name: 'Create Offer' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('admin service types page lists a seeded service type', async ({ page }) => {
    const name = `E2E Service Type ${Date.now()}`;
    // Admin-created service types are automatically approved.
    await callZome(client, 'service_types', 'create_service_type', {
      service_type: {
        name,
        description: 'Seeded for the core e2e flow',
        technical: false,
      },
    });

    await gotoApp(page, '/admin/service-types');
    await waitForConnection(page);

    await expect(page.locator(`text=${name}`)).toBeVisible({ timeout: 15_000 });
  });

  test('admin mediums of exchange page lists a seeded medium of exchange', async ({ page }) => {
    const code = `E2E${Date.now()}`;
    // Admin-created entries go directly to approved status.
    await callZome(client, 'mediums_of_exchange', 'create_medium_of_exchange', {
      medium_of_exchange: {
        code,
        name: 'E2E Test Currency',
        description: 'Seeded for the core e2e flow',
        exchange_type: 'currency',
        resource_spec_hrea_id: null,
      },
    });

    await gotoApp(page, '/admin/mediums-of-exchange');
    await waitForConnection(page);

    await expect(page.locator(`text=${code}`)).toBeVisible({ timeout: 15_000 });
  });

  test('user can create an offer that appears in the offers list', async ({ page }) => {
    await gotoApp(page, '/offers/create');
    await waitForConnection(page);

    const title = `E2E Offer ${Date.now()}`;
    await page.getByPlaceholder('What are you offering?').fill(title);
    await page
      .getByPlaceholder('Describe your offer in detail (Markdown supported)')
      .fill('Created by the core e2e flow.');
    // Matches the service type seeded in the admin service-types test above.
    await page.locator('label:has-text("E2E Service Type") input[type="checkbox"]').first().check();

    await page.getByRole('button', { name: 'Create Offer' }).click();

    await expect(page).toHaveURL(/\/offers$/, { timeout: 15_000 });
    // The title renders in both the card and table views, so scope to the
    // first match to avoid a strict-mode "resolved to N elements" violation.
    await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('user can create a request that appears in the requests list', async ({ page }) => {
    await gotoApp(page, '/requests/create');
    await waitForConnection(page);

    const title = `E2E Request ${Date.now()}`;
    await page.getByPlaceholder('Enter request title').fill(title);
    await page
      .getByPlaceholder('Describe your request in detail (Markdown supported)')
      .fill('Created by the core e2e flow.');
    await page.locator('label:has-text("E2E Service Type") input[type="checkbox"]').first().check();

    await page.getByRole('button', { name: 'Create Request' }).click();

    await expect(page).toHaveURL(/\/requests$/, { timeout: 15_000 });
    // The title renders in both the card and table views, so scope to the
    // first match to avoid a strict-mode "resolved to N elements" violation.
    await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 10_000 });
  });
});
