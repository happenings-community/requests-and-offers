import { test, expect } from '@playwright/test';
import {
  gotoApp,
  createTestClient,
  ensureAcceptedUser,
  ensureServiceType,
  ensureMediumOfExchange,
  selectTimezone
} from '../utils/e2e-helpers.js';
import type { AppWebsocket } from '@holochain/client';

// ============================================================================
// 02 — SERVICE TYPES
//
// The catalog chapter: admin creates and edits service types through the
// admin forms, an accepted user suggests one through the public form, and
// the moderation queue approves one suggestion and rejects another.
// Verifies the visibility rule everywhere: only APPROVED service types are
// publicly listed.
// ============================================================================

const ADMIN_ST = 'E2E Admin Curated';
const SUGGESTED_ST = 'E2E Suggested Approved';
const REJECTED_ST = 'E2E Suggested Rejected';

async function suggestServiceType(page: import('@playwright/test').Page, name: string) {
  await gotoApp(page, '/service-types/suggest');
  await expect(page.getByRole('heading', { name: 'Suggest a New Service Type' })).toBeVisible({
    timeout: 15_000
  });
  await page.getByPlaceholder('e.g., Web Development').fill(name);
  await page
    .getByPlaceholder('Brief description of this service type')
    .fill('Suggested during the e2e service-types journey.');
  await page.getByRole('button', { name: 'Suggest', exact: true }).click();
  // Submission clears/toasts; give the zome call a moment to land.
  await page.waitForTimeout(1_000);
}

test.describe.serial('02 — service types: curation, suggestion, moderation', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
    // The Bug 1 regression test creates an offer through the real form, which
    // PrerequisitesGuard blocks unless both a service type and a medium of
    // exchange exist.
    await ensureServiceType(client, 'E2E Service Type');
    await ensureMediumOfExchange(client, 'E2EBASE');
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('admin creates a service type through the form', async ({ page }) => {
    await gotoApp(page, '/admin/service-types/create');

    await expect(page.getByRole('heading', { name: 'Create Service Type' })).toBeVisible({
      timeout: 30_000
    });
    await page.getByPlaceholder('Enter service type name').fill(ADMIN_ST);
    await page
      .getByPlaceholder('Describe this service type in detail')
      .fill('Curated by the admin during the e2e journey.');
    await page.getByRole('button', { name: 'Create Service Type' }).click();

    await expect(page).toHaveURL(/\/admin\/service-types(\?|$)/, { timeout: 15_000 });
    await expect(page.locator(`text=${ADMIN_ST}`).first()).toBeVisible({ timeout: 15_000 });
  });

  test('admin-created service type is approved and publicly listed', async ({ page }) => {
    await gotoApp(page, '/service-types');

    await expect(page.getByRole('heading', { name: 'Available Service Types' })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator(`text=${ADMIN_ST}`).first()).toBeVisible({ timeout: 15_000 });

    // Its public detail page renders with Approved status.
    await page.getByRole('button', { name: ADMIN_ST }).first().click();
    await expect(page.getByRole('heading', { name: ADMIN_ST }).first()).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator('text=Approved').first()).toBeVisible();
  });

  test('admin edits the service type through the form', async ({ page }) => {
    await gotoApp(page, '/admin/service-types');
    await expect(page.locator(`text=${ADMIN_ST}`).first()).toBeVisible({ timeout: 30_000 });

    await page
      .locator('tr', { hasText: ADMIN_ST })
      .getByRole('button', { name: 'Edit service type' })
      .click();

    await expect(page.getByRole('heading', { name: 'Edit Service Type' }).first()).toBeVisible({
      timeout: 15_000
    });
    await page
      .getByPlaceholder('Describe this service type in detail')
      .fill('Curated and refined by the admin during the e2e journey.');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.locator('text=Service type updated successfully').first()).toBeVisible({
      timeout: 15_000
    });
  });

  // Bug 1 regression test: after a service type is edited, creating an offer
  // that selects it must NOT fail with "Cannot link to a service type that
  // is not approved". The approval link targets the ORIGINAL action hash;
  // before the fix, is_service_type_approved checked the UPDATE hash and
  // returned false, so create_offer rejected the link.
  test('edited service type remains usable in a new offer (Bug 1 regression)', async ({
    page
  }) => {
    await gotoApp(page, '/offers/create');

    await page.getByPlaceholder('What are you offering?').fill('E2E Bug 1 Regression Offer');
    await page
      .getByPlaceholder('Describe your offer in detail (Markdown supported)')
      .fill('Offer created from an EDITED service type — must not fail linking.');

    // Select the EDITED service type through the real selector. The selector
    // is now keyed (Bug 2 fix), so we can rely on a direct click without
    // the filter-first workaround.
    await page.getByPlaceholder('Search and select service types...').fill(ADMIN_ST);
    await page
      .locator('label:has-text("' + ADMIN_ST + '") input[type="checkbox"]')
      .first()
      .check();
    await expect(page.locator('.chip', { hasText: ADMIN_ST }).first()).toBeVisible({
      timeout: 5_000
    });

    await selectTimezone(page);

    // This is the assertion that flips green-to-red-to-green: pre-fix the
    // submit throws a Wasm guest error ("Cannot link to a service type that
    // is not approved") and the offer never appears in the list.
    await page.getByRole('button', { name: 'Create Offer' }).click();

    await expect(page).toHaveURL(/\/offers$/, { timeout: 15_000 });
    await expect(
      page.locator('text=E2E Bug 1 Regression Offer').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('accepted user suggests a service type — it stays out of the public list', async ({
    page
  }) => {
    await suggestServiceType(page, SUGGESTED_ST);

    // Anti-criterion: pending suggestions are never publicly listed.
    await gotoApp(page, '/service-types');
    await expect(page.getByRole('heading', { name: 'Available Service Types' })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator(`text=${SUGGESTED_ST}`)).toBeHidden();
  });

  test('admin approves the suggestion from the moderation queue', async ({ page }) => {
    await gotoApp(page, '/admin/service-types/moderate');

    await expect(
      page.getByRole('heading', { name: 'Moderate Service Type Suggestions' })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(`text=${SUGGESTED_ST}`).first()).toBeVisible({ timeout: 15_000 });

    await page
      .locator('tr', { hasText: SUGGESTED_ST })
      .getByRole('button', { name: 'Approve' })
      .click();

    // The row moves from the Pending tab to Approved.
    await page.getByRole('tab', { name: /Approved \(/ }).click();
    await expect(page.locator(`text=${SUGGESTED_ST}`).first()).toBeVisible({ timeout: 15_000 });

    // And it is now publicly listed.
    await gotoApp(page, '/service-types');
    await expect(page.locator(`text=${SUGGESTED_ST}`).first()).toBeVisible({ timeout: 15_000 });
  });

  test('admin rejects a second suggestion — it never reaches the public list', async ({
    page
  }) => {
    await suggestServiceType(page, REJECTED_ST);

    await gotoApp(page, '/admin/service-types/moderate');
    await expect(page.locator(`text=${REJECTED_ST}`).first()).toBeVisible({ timeout: 30_000 });

    await page
      .locator('tr', { hasText: REJECTED_ST })
      .getByRole('button', { name: 'Reject' })
      .click();

    await page.getByRole('tab', { name: /Rejected \(/ }).click();
    await expect(page.locator(`text=${REJECTED_ST}`).first()).toBeVisible({ timeout: 15_000 });

    await gotoApp(page, '/service-types');
    await expect(page.getByRole('heading', { name: 'Available Service Types' })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator(`text=${REJECTED_ST}`)).toBeHidden();
  });

  test('legacy tags route redirects to service types', async ({ page }) => {
    await gotoApp(page, '/tags/anything');

    await expect(page).toHaveURL(/\/service-types(\?|$)/, { timeout: 15_000 });
  });
});
