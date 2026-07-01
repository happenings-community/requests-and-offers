import { test, expect } from '@playwright/test';
import { gotoApp, createTestClient, callZome, waitForConnection } from '../utils/e2e-helpers.js';
import type { AppWebsocket } from '@holochain/client';

// ============================================================================
// ADMIN MANAGEMENT
//
// The test agent auto-registers as network administrator by being the first
// user in the sandbox (see users_organizations::create_user). Admin status
// is checked directly via check_if_agent_is_administrator and does not
// depend on the profile's own accepted/pending status, so no extra
// acceptance step is needed here (contrast with offer-request-flow.spec.ts).
//
// Seeds one service type and one medium of exchange via direct zome calls
// (admin-created entries are auto-approved) and verifies both are listed on
// their respective admin pages.
// ============================================================================

test.describe('Admin management', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();

    await callZome(client, 'users_organizations', 'create_user', {
      name: 'E2E Admin User',
      nickname: 'admin_user',
      bio: 'Seeded for the admin-management e2e test',
      profile_picture: null,
      user_type: 'advocate',
      skills: ['administration'],
      email: 'admin@example.com',
      phone: null,
      time_zone: 'UTC',
      location: 'Test City'
    });
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('admin service types page lists a seeded service type', async ({ page }) => {
    const name = `E2E Service Type ${Date.now()}`;
    await callZome(client, 'service_types', 'create_service_type', {
      service_type: {
        name,
        description: 'Seeded directly via zome call for the admin-management e2e test',
        technical: false
      }
    });

    await gotoApp(page, '/admin/service-types');
    await waitForConnection(page);

    await expect(page.locator(`text=${name}`)).toBeVisible({ timeout: 15_000 });
  });

  test('admin mediums of exchange page lists a seeded medium of exchange', async ({ page }) => {
    const code = `E2E${Date.now()}`;
    await callZome(client, 'mediums_of_exchange', 'create_medium_of_exchange', {
      medium_of_exchange: {
        code,
        name: 'E2E Test Currency',
        description: 'Seeded directly via zome call for the admin-management e2e test',
        exchange_type: 'currency',
        resource_spec_hrea_id: null
      }
    });

    await gotoApp(page, '/admin/mediums-of-exchange');
    await waitForConnection(page);

    await expect(page.locator(`text=${code}`)).toBeVisible({ timeout: 15_000 });
  });
});
