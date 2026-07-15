import { test, expect } from '@playwright/test';
import {
  gotoApp,
  createTestClient,
  ensureAcceptedUser,
  ensureServiceType,
  ensureMediumOfExchange
} from '../utils/e2e-helpers.js';
import type { AppWebsocket } from '@holochain/client';

// ============================================================================
// 03 — MEDIUMS OF EXCHANGE
//
// Admin lifecycle (create → approve → edit) through the admin forms, plus
// the only user-facing exchange surface in the current UI: suggesting a new
// medium from within the offer create form.
//
// Gotcha encoded here: the admin create form internally calls
// suggestMediumOfExchange, so even admin-created mediums land in the
// PENDING tab and need an explicit approval (the list defaults to the
// Approved tab).
// ============================================================================

const MOE_NAME = 'E2E Journey Currency';
const MOE_NAME_EDITED = 'E2E Journey Currency (edited)';
const MOE_SUGGESTED = 'E2E User Suggested Medium';

test.describe.serial('03 — mediums of exchange: lifecycle and suggestion', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
    // PrerequisitesGuard blocks /offers/create unless both service types and
    // mediums of exchange exist — make sure both do for the suggestion test.
    await ensureServiceType(client, 'E2E Service Type');
    await ensureMediumOfExchange(client, 'E2EBASE');
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('admin creates a medium of exchange through the form (lands pending)', async ({
    page
  }) => {
    await gotoApp(page, '/admin/mediums-of-exchange/create');

    await expect(page.getByRole('heading', { name: 'Create Medium of Exchange' })).toBeVisible({
      timeout: 30_000
    });
    // Exchange type is a radio-card group; "Specific Currency" is the default.
    await page.getByPlaceholder('e.g., USD, EUR, BTC, HOURS').fill('E2EJC');
    await page.getByPlaceholder('e.g., US Dollar, Bitcoin, Ithaca HOURS').fill(MOE_NAME);
    await page.getByRole('button', { name: 'Create Medium of Exchange' }).click();

    await expect(page).toHaveURL(/\/admin\/mediums-of-exchange(\?|$)/, { timeout: 15_000 });

    // The list opens on the Approved tab; the new medium is in Pending.
    await page.getByRole('tab', { name: /Pending \(/ }).click();
    await expect(page.locator(`text=${MOE_NAME}`).first()).toBeVisible({ timeout: 15_000 });
  });

  test('admin approves the pending medium', async ({ page }) => {
    await gotoApp(page, '/admin/mediums-of-exchange');

    await expect(
      page.getByRole('heading', { name: 'Manage Mediums of Exchange' })
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: /Pending \(/ }).click();
    await expect(page.locator(`text=${MOE_NAME}`).first()).toBeVisible({ timeout: 15_000 });

    await page.locator('tr', { hasText: MOE_NAME }).getByRole('button', { name: 'Approve' }).click();

    await page.getByRole('tab', { name: /Approved \(/ }).click();
    await expect(page.locator(`text=${MOE_NAME}`).first()).toBeVisible({ timeout: 15_000 });
  });

  test('admin edits the medium through the form', async ({ page }) => {
    await gotoApp(page, '/admin/mediums-of-exchange');
    await page.getByRole('tab', { name: /Approved \(/ }).click();
    await expect(page.locator(`text=${MOE_NAME}`).first()).toBeVisible({ timeout: 30_000 });

    await page.locator('tr', { hasText: MOE_NAME }).getByRole('button', { name: 'Edit' }).click();

    await expect(page.getByRole('heading', { name: 'Edit Medium of Exchange' })).toBeVisible({
      timeout: 15_000
    });
    // The edit page resolves its ID in onMount — wait for the populated form.
    // Target the field by its accessible name: the placeholder varies with
    // the medium's stored exchange type (base vs currency).
    const nameInput = page.getByRole('textbox', { name: /Display Name/ });
    await expect(nameInput).toHaveValue(MOE_NAME, { timeout: 15_000 });

    await nameInput.fill(MOE_NAME_EDITED);
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page).toHaveURL(/\/admin\/mediums-of-exchange(\?|$)/, { timeout: 15_000 });

    // KNOWN APP GAP: the MoE list zome functions get() the original create
    // action, so the list keeps showing the pre-edit name (service types
    // resolve latest records; mediums don't). Verify persistence through the
    // edit page instead, which loads the latest record.
    await page.getByRole('tab', { name: /Approved \(/ }).click();
    await page.locator('tr', { hasText: MOE_NAME }).getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByRole('textbox', { name: /Display Name/ })).toHaveValue(
      MOE_NAME_EDITED,
      { timeout: 15_000 }
    );
  });

  test('user suggests a new medium from the offer form', async ({ page }) => {
    await gotoApp(page, '/offers/create');

    await expect(page.getByRole('heading', { name: 'Create Offer' }).first()).toBeVisible({
      timeout: 15_000
    });
    await page.getByRole('button', { name: /Suggest New/ }).click();

    await expect(
      page.getByRole('heading', { name: 'Suggest New Medium of Exchange' })
    ).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('e.g., US Dollar, Bitcoin, Euro').fill(MOE_SUGGESTED);
    await page.getByRole('button', { name: 'Suggest Medium' }).click();

    await expect(page.locator('text=Thank you for your suggestion').first()).toBeVisible({
      timeout: 10_000
    });

    // The suggestion lands in the admin Pending queue.
    await gotoApp(page, '/admin/mediums-of-exchange');
    await page.getByRole('tab', { name: /Pending \(/ }).click();
    await expect(page.locator(`text=${MOE_SUGGESTED}`).first()).toBeVisible({ timeout: 15_000 });
  });
});
