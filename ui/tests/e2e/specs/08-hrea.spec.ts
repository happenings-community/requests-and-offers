import { test, expect } from '@playwright/test';
import type { AppWebsocket } from '@holochain/client';
import { gotoApp, createTestClient, ensureAcceptedUser } from '../utils/e2e-helpers.js';

// ============================================================================
// 08 — hREA SMOKE
//
// The hApp bundle installs the hREA DNA as a second role (workdir/happ.yaml)
// and the only UI surface exercising it today is the admin hREA test
// interface. This is a smoke check: the page mounts against the real hREA
// cell without erroring. Deep hREA flows (proposals, intents, agreements)
// have no user-facing UI yet — covered when the exchange-process UI lands.
// ============================================================================

test.describe.serial('08 — hREA integration smoke', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('hREA test interface mounts against the hREA cell', async ({ page }) => {
    await gotoApp(page, '/admin/hrea-test');

    await expect(page.getByRole('heading', { name: 'hREA Test Interface' })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.locator('text=About hREA Integration').first()).toBeVisible({
      timeout: 15_000
    });
    // The page must not crash into the admin layout's failure state.
    await expect(page.locator('text=Admin data loading failed')).toBeHidden();
  });
});
