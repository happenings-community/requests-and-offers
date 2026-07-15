import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
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
// 04 — OFFERS
//
// Full single-agent offer lifecycle through the real UI: create via the
// form, read the detail page, edit, see it in My Listings and the admin
// list, archive it from the My Listings card (Skeleton ConfirmModal), and
// finally delete it.
//
// Detail-page navigation is done by URL (hash resolved via zome call) —
// the list renders both card and table views, so clicking "the" row button
// is ambiguous; the URL is the stable path.
// ============================================================================

const OFFER_TITLE = 'E2E Journey Offer';
const OFFER_TITLE_EDITED = 'E2E Journey Offer (edited)';

async function offerHashByTitle(client: AppWebsocket, title: string): Promise<string> {
  const records = (await callZome(client, 'offers', 'get_active_offers', null)) as HolochainRecord[];
  const match = records.find((r) => decodeRecordEntry<{ title: string }>(r)?.title === title);
  if (!match) throw new Error(`[e2e] No active offer titled "${title}"`);
  return encodeHashToBase64(match.signed_action.hashed.hash);
}

async function openMyListings(page: Page) {
  await gotoApp(page, '/my-listings');
  await expect(page.getByRole('heading', { name: 'My Listings' })).toBeVisible({
    timeout: 15_000
  });
}

test.describe.serial('04 — offers: full lifecycle through the UI', () => {
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

  test('user creates an offer through the form', async ({ page }) => {
    await gotoApp(page, '/offers/create');

    await page.getByPlaceholder('What are you offering?').fill(OFFER_TITLE);
    await page
      .getByPlaceholder('Describe your offer in detail (Markdown supported)')
      .fill('Created by the offers e2e journey.');
    // ServiceTypeSelector renders an UNKEYED {#each} over a list that
    // re-sorts after async loads — clicking a checkbox can race the
    // re-render and toggle a different item. Filter down to a single option
    // first, then verify the selection chip shows the intended name.
    await page.getByPlaceholder('Search and select service types...').fill('E2E Service Type');
    await page.locator('label:has-text("E2E Service Type") input[type="checkbox"]').first().check();
    await expect(page.locator('.chip', { hasText: 'E2E Service Type' }).first()).toBeVisible({
      timeout: 5_000
    });
    // Time zone is required and has no default — without it the submit stays disabled.
    await selectTimezone(page);

    await page.getByRole('button', { name: 'Create Offer' }).click();

    await expect(page).toHaveURL(/\/offers$/, { timeout: 15_000 });
    // Title renders in both card and table views — scope to the first match.
    await expect(page.locator(`text=${OFFER_TITLE}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('offer detail page renders the offer', async ({ page }) => {
    const hash = await offerHashByTitle(client, OFFER_TITLE);
    await gotoApp(page, `/offers/${hash}`);

    await expect(page.getByRole('heading', { name: OFFER_TITLE }).first()).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator('text=Created by the offers e2e journey.').first()).toBeVisible();
    // Use the heading role — a plain text match hits the hidden nav
    // dropdown's "Service Types" item first.
    await expect(page.getByRole('heading', { name: 'Service Types' })).toBeVisible();
    await expect(page.locator('text=E2E Service Type').first()).toBeVisible();
  });

  test('user edits the offer through the form', async ({ page }) => {
    const hash = await offerHashByTitle(client, OFFER_TITLE);
    await gotoApp(page, `/offers/${hash}/edit`);

    const titleInput = page.getByPlaceholder('What are you offering?');
    await expect(titleInput).toHaveValue(OFFER_TITLE, { timeout: 15_000 });

    await titleInput.fill(OFFER_TITLE_EDITED);
    await page.getByRole('button', { name: 'Update Offer' }).click();

    // Confirm the update landed by re-reading the detail page.
    await gotoApp(page, `/offers/${hash}`);
    await expect(page.getByRole('heading', { name: OFFER_TITLE_EDITED }).first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('my listings shows the active offer', async ({ page }) => {
    await openMyListings(page);

    await expect(page.locator('text=My Active Offers').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`text=${OFFER_TITLE_EDITED}`).first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('admin offers page lists the offer', async ({ page }) => {
    await gotoApp(page, '/admin/offers');

    await expect(page.getByRole('heading', { name: 'Offers Management' })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.locator(`text=${OFFER_TITLE_EDITED}`).first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('user archives the offer from my listings', async ({ page }) => {
    await openMyListings(page);
    await expect(page.locator(`text=${OFFER_TITLE_EDITED}`).first()).toBeVisible({
      timeout: 15_000
    });

    await page.getByRole('button', { name: /Archive/ }).first().click();
    // Card archive uses a Skeleton ConfirmModal (not a native dialog).
    await expect(
      page.locator('text=Are you sure you want to archive this offer?').first()
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Archive', exact: true }).click();

    // The offer leaves the active tab and shows under Archived Listings.
    await page.getByRole('button', { name: /Archived Listings/ }).click();
    await expect(page.locator(`text=${OFFER_TITLE_EDITED}`).first()).toBeVisible({
      timeout: 15_000
    });

    // Anti-criterion: archived offers leave the public active list.
    await gotoApp(page, '/offers');
    await expect(page.locator(`text=${OFFER_TITLE_EDITED}`)).toBeHidden({ timeout: 15_000 });
  });

  test('user deletes the archived offer', async ({ page }) => {
    await openMyListings(page);
    await page.getByRole('button', { name: /Archived Listings/ }).click();
    await expect(page.locator(`text=${OFFER_TITLE_EDITED}`).first()).toBeVisible({
      timeout: 15_000
    });

    await page.getByRole('button', { name: /Delete/ }).first().click();
    await expect(
      page.locator('text=Are you sure you want to delete this offer?').first()
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.locator(`text=${OFFER_TITLE_EDITED}`)).toBeHidden({ timeout: 15_000 });
  });
});
