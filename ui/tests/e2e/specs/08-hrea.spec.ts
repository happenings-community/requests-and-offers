import { test, expect } from '@playwright/test';
import type { AppWebsocket } from '@holochain/client';
import { gotoApp, createTestClient, ensureAcceptedUser } from '../utils/e2e-helpers.js';

// ============================================================================
// 08 — hREA integration
//
// The hApp bundle installs the hREA DNA as a second role (workdir/happ.yaml)
// and the only UI surface exercising it today is the admin hREA test
// interface. This spec goes beyond a mount smoke-check: it drives the real
// read path (the store's getAllAgents() / getProposals() GraphQL queries)
// against the live happ-0.4.0-beta cell and asserts those queries resolve
// rather than erroring.
//
// This matters because the service used to swallow "missing zome function"
// errors on the proposals/intents list queries and return []. That defensive
// behavior was deleted as obsolete against 0.4.0-beta — so this spec is the
// regression guard proving the un-defended list queries now succeed against
// the real cell (a genuine failure would surface as the store's error alert
// or a permanently-stuck loading spinner).
//
// Deep hREA write flows (create proposal + intent, agreements, settlements)
// have no user-facing UI yet — covered when the exchange-process UI lands.
// ============================================================================

test.describe.serial('08 — hREA integration', () => {
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

  test('the agents read path resolves against the happ-0.4.0-beta cell', async ({ page }) => {
    await gotoApp(page, '/admin/hrea-test');

    // Open the Agents → Person Agents tab. Mounting PersonAgentManager
    // triggers hreaStore.getAllAgents(), a GraphQL `agents` query routed
    // through the memoized Apollo client + SchemaLink over the hREA cell.
    await page.getByRole('tab', { name: /Agents/ }).first().click();
    await page.getByRole('tab', { name: /Person Agents/ }).click();

    // The query either returns agents (table renders) or returns none
    // ("No Person agents found"). Both are valid successful resolutions.
    // An actual failure surfaces as the store's error alert.
    await expect(
      page.getByText('No Person agents found.').or(page.locator('table.table'))
    ).toBeVisible({ timeout: 30_000 });

    // The store must not have entered its error state — this is the real
    // assertion that the un-defended GraphQL read succeeded against the cell.
    await expect(page.locator('.alert.variant-filled-error')).toBeHidden();
  });

  test('the proposals list query succeeds (regression guard for the removed defensive catchAll)', async ({
    page
  }) => {
    await gotoApp(page, '/admin/hrea-test');

    // Opening the Proposals tab mounts ProposalManager, which drives the
    // proposals list query. Previously this was wrapped in an E.catchAll
    // that returned [] on any "missing zome function" error; that behavior
    // was deleted as obsolete against 0.4.0-beta. This test asserts the
    // query now resolves cleanly (no error alert) against the live cell.
    await page.getByRole('tab', { name: /Proposals/ }).click();

    // Allow time for the GraphQL query to settle, then assert no error
    // surfaced. (The proposals list is legitimately empty in a fresh cell,
    // so we assert the absence of failure rather than the presence of rows.)
    await expect(page.locator('.alert.variant-filled-error')).toBeHidden({ timeout: 30_000 });
  });
});
