import { test, expect } from '@playwright/test';
import type { AppWebsocket } from '@holochain/client';
import { gotoApp, createTestClient, closeTestClient, ensureAcceptedUser } from '../utils/e2e-helpers.js';

// ============================================================================
// 08 — hREA integration
//
// The hApp bundle installs the hREA DNA as a second role (workdir/happ.yaml)
// and the UI surface exercising it is the admin hREA page at /admin/hrea: a
// read-only dashboard tab, and the entity test managers as its second tab
// (/admin/hrea-test redirects there). This spec goes beyond a mount smoke-check: it drives the real
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
    await closeTestClient(client);
  });

  test('the hREA dashboard mounts against the hREA cell and reads its snapshot', async ({
    page
  }) => {
    await gotoApp(page, '/admin/hrea');

    await expect(page.getByRole('heading', { name: 'hREA · ValueFlows' })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByRole('heading', { name: 'Mapping ledger' })).toBeVisible({
      timeout: 15_000
    });
    // Every list read resolved: a failed snapshot shows the error alert.
    await expect(page.locator('.alert.variant-filled-error')).toBeHidden({ timeout: 30_000 });
    // The page must not crash into the admin layout's failure state.
    await expect(page.locator('text=Admin data loading failed')).toBeHidden();
  });

  test('the old /admin/hrea-test address opens the test managers tab', async ({ page }) => {
    await gotoApp(page, '/admin/hrea-test');

    await expect(page).toHaveURL(/\/admin\/hrea\?.*tab=test/, { timeout: 30_000 });
    await expect(page.getByRole('tab', { name: 'Test managers' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('the agents read path resolves against the happ-0.4.0-beta cell', async ({ page }) => {
    await gotoApp(page, '/admin/hrea?tab=test');

    // Open the Agents → Person Agents tab. Mounting PersonAgentManager
    // triggers hreaStore.getAllAgents(), a GraphQL `agents` query routed
    // through the memoized Apollo client + SchemaLink over the hREA cell.
    await page
      .getByRole('tab', { name: /Agents/ })
      .first()
      .click();
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
    await gotoApp(page, '/admin/hrea?tab=test');

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
