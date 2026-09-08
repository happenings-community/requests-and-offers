import { test, expect } from '@playwright/test';
import { encodeHashToBase64 } from '@holochain/client';
import type { AppWebsocket, Record as HolochainRecord } from '@holochain/client';
import {
  gotoApp,
  selectTimezone,
  createTestClient,
  callZome,
  ensureAcceptedUser,
  ensureServiceType,
  ensureMediumOfExchange,
  decodeRecordEntry
} from '../utils/e2e-helpers.js';

// ============================================================================
// 05 — REQUESTS
//
// Mirror of the offers lifecycle with one deliberate difference: deletion
// happens from the DETAIL page, which uses a native window.confirm dialog
// (unlike the My Listings cards' Skeleton modal) — so both confirm
// mechanisms in the app get e2e coverage.
// ============================================================================

const REQUEST_TITLE = 'E2E Journey Request';
const REQUEST_TITLE_EDITED = 'E2E Journey Request (edited)';

async function requestHashByTitle(client: AppWebsocket, title: string): Promise<string> {
  // get_active_requests resolves LATEST records, so after an edit the match
  // is an Update action — the detail route needs the ORIGINAL action hash,
  // which Update actions carry as original_action_address.
  const records = (await callZome(
    client,
    'requests',
    'get_active_requests',
    null
  )) as HolochainRecord[];
  const match = records.find((r) => decodeRecordEntry<{ title: string }>(r)?.title === title);
  if (!match) throw new Error(`[e2e] No active request titled "${title}"`);
  const action = match.signed_action.hashed.content as {
    original_action_address?: Uint8Array;
  };
  return encodeHashToBase64(action.original_action_address ?? match.signed_action.hashed.hash);
}

test.describe.serial('05 — requests: full lifecycle through the UI', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
    await ensureServiceType(client, 'E2E Service Type');
    await ensureMediumOfExchange(client, 'E2EBASE');
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('form refuses to save with a link typed but not added', async ({ page }) => {
    const title = 'E2E Unadded Link Request';
    await gotoApp(page, '/requests/create');

    await page.getByPlaceholder('Enter request title').fill(title);
    await page
      .getByPlaceholder('Describe your request in detail (Markdown supported)')
      .fill('Must never be saved: the links chip holds unadded text.');
    await page.getByPlaceholder('Search and select service types...').fill('E2E Service Type');
    await page.locator('label:has-text("E2E Service Type") input[type="checkbox"]').first().check();
    await expect(page.locator('.chip', { hasText: 'E2E Service Type' }).first()).toBeVisible({
      timeout: 5_000
    });
    await selectTimezone(page);

    // Type into the links chip and do not press Enter, so the text stays
    // pending in the input rather than becoming a chip.
    await page.locator('label:has-text("Links (optional)") input.input-chip-field').fill('https://example.org/unadded');

    await page.getByRole('button', { name: 'Create Request' }).click();

    await expect(page.locator('aside.alert', { hasText: 'typed but not added' })).toBeVisible();
    await expect(
      page.locator('label:has-text("Links (optional)") input.input-chip-field')
    ).toBeFocused();
    await expect(page).toHaveURL(/\/requests\/create(\?|$)/);

    // The refusal has to reach the DHT: nothing by this title was written.
    const records = (await callZome(client, 'requests', 'get_active_requests', null)) as HolochainRecord[];
    expect(records.some((r) => decodeRecordEntry<{ title: string }>(r)?.title === title)).toBe(false);
  });

  test('user creates a request through the form', async ({ page }) => {
    await gotoApp(page, '/requests/create');

    await page.getByPlaceholder('Enter request title').fill(REQUEST_TITLE);
    await page
      .getByPlaceholder('Describe your request in detail (Markdown supported)')
      .fill('Created by the requests e2e journey.');
    // Filter-first to dodge ServiceTypeSelector's unkeyed re-render race
    // (see 04-offers.spec.ts) and verify the selection chip.
    await page.getByPlaceholder('Search and select service types...').fill('E2E Service Type');
    await page.locator('label:has-text("E2E Service Type") input[type="checkbox"]').first().check();
    await expect(page.locator('.chip', { hasText: 'E2E Service Type' }).first()).toBeVisible({
      timeout: 5_000
    });
    // Time zone is required and has no default — without it the submit stays disabled.
    await selectTimezone(page);

    await page.getByRole('button', { name: 'Create Request' }).click();

    await expect(page).toHaveURL(/\/requests$/, { timeout: 15_000 });
    await expect(page.locator(`text=${REQUEST_TITLE}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('request detail page renders the request', async ({ page }) => {
    const hash = await requestHashByTitle(client, REQUEST_TITLE);
    await gotoApp(page, `/requests/${hash}`);

    await expect(page.getByRole('heading', { name: REQUEST_TITLE }).first()).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator('text=Created by the requests e2e journey.').first()).toBeVisible();
    // Heading role — plain text hits the hidden nav dropdown item first.
    await expect(page.getByRole('heading', { name: 'Service Types' })).toBeVisible();
  });

  test('user edits the request through the form', async ({ page }) => {
    const hash = await requestHashByTitle(client, REQUEST_TITLE);
    await gotoApp(page, `/requests/${hash}/edit`);

    const titleInput = page.getByPlaceholder('Enter request title');
    await expect(titleInput).toHaveValue(REQUEST_TITLE, { timeout: 15_000 });

    await titleInput.fill(REQUEST_TITLE_EDITED);
    await page.getByRole('button', { name: 'Update Request' }).click();

    // On success the edit page navigates to the detail page — wait for that
    // instead of reloading, which would abort the in-flight zome call.
    await expect(page).toHaveURL(/\/requests\/[^/?]+(\?|$)/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: REQUEST_TITLE_EDITED }).first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('my listings and the admin list both show the request', async ({ page }) => {
    await gotoApp(page, '/my-listings');
    await expect(page.locator('text=My Active Requests').first()).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator(`text=${REQUEST_TITLE}`).first()).toBeVisible({
      timeout: 15_000
    });

    await gotoApp(page, '/admin/requests');
    await expect(page.getByRole('heading', { name: 'Requests Management' })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.locator(`text=${REQUEST_TITLE}`).first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('user deletes the request from its detail page (native confirm)', async ({ page }) => {
    // Post-edit, the active list resolves latest records — look up by the
    // edited title.
    const hash = await requestHashByTitle(client, REQUEST_TITLE_EDITED);
    await gotoApp(page, `/requests/${hash}`);
    // The detail page resolves the LATEST record, so it shows the edited title.
    await expect(page.getByRole('heading', { name: REQUEST_TITLE_EDITED }).first()).toBeVisible({
      timeout: 15_000
    });

    // The detail page uses window.confirm — accept it via the dialog event.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page).toHaveURL(/\/requests(\?|$)/, { timeout: 15_000 });
    await expect(page.locator(`text=${REQUEST_TITLE}`)).toBeHidden({ timeout: 15_000 });
  });
});
