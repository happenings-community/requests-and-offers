import { test, expect } from '@playwright/test';
import type { AppWebsocket } from '@holochain/client';
import { gotoApp, createTestClient, ensureAcceptedUser } from '../utils/e2e-helpers.js';

// ============================================================================
// 06 — ORGANIZATIONS
//
// Organization lifecycle within single-agent reach: create through the real
// form, verify the pending-visibility rule, approve from the admin
// dashboard's Pending Orgs queue, then edit as coordinator and check the
// status-history audit trail. Multi-agent membership flows (inviting other
// members/coordinators) are Sweettest territory — one agent per run here.
// ============================================================================

const ORG_NAME = 'E2E Journey Collective';
const ORG_LOCATION_EDITED = 'E2E Edited Location';

test.describe.serial('06 — organizations: creation, moderation, edit', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('user creates an organization through the form', async ({ page }) => {
    await gotoApp(page, '/organizations/create');

    await expect(page.getByRole('heading', { name: 'Create new Organization' })).toBeVisible({
      timeout: 15_000
    });

    await page.locator('input[name="name"]').fill(ORG_NAME);
    await page
      .getByPlaceholder('Official legal name of your organization')
      .fill('E2E Journey Collective Inc.');
    await page.locator('input[name="email"]').fill('collective@e2e.example.com');
    await page
      .getByPlaceholder("Describe your organization's vision and mission... (Markdown supported)")
      .fill('A collective founded during the e2e journey.');
    await page.locator('input[name="location"]').fill('Test City');

    await page.getByRole('button', { name: 'Create Organization' }).click();

    // A success alert modal may flash before the redirect — dismiss it if it
    // shows, but the durable signal is landing on the new detail page.
    await page
      .getByRole('button', { name: /^Ok/ })
      .click({ timeout: 8_000 })
      .catch(() => {});

    await expect(page).toHaveURL(/\/organizations\/[^/?]+(\?|$)/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: ORG_NAME }).first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('pending organization is hidden from the public list', async ({ page }) => {
    await gotoApp(page, '/organizations');

    await expect(page.getByRole('heading', { name: 'Organizations' }).first()).toBeVisible({
      timeout: 15_000
    });
    // Anti-criterion: only accepted organizations are publicly listed.
    await expect(page.locator(`text=${ORG_NAME}`)).toBeHidden();
  });

  test('admin approves the organization from the dashboard queue', async ({ page }) => {
    await gotoApp(page, '/admin');

    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({
      timeout: 30_000
    });
    await page.getByRole('tab', { name: /Pending Orgs \(1\)/ }).click();
    await expect(page.locator(`text=${ORG_NAME}`).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Approve' }).first().click();

    await expect(page.locator('text=Organization approved.').first()).toBeVisible({
      timeout: 10_000
    });
  });

  test('accepted organization appears publicly with a working detail page', async ({ page }) => {
    await gotoApp(page, '/organizations');
    await expect(page.locator(`text=${ORG_NAME}`).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'View', exact: true }).first().click();

    await expect(page.getByRole('heading', { name: ORG_NAME }).first()).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole('tab', { name: 'Members' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Coordinators' })).toBeVisible();
  });

  test('coordinator edits the organization through the form', async ({ page }) => {
    // The creator is automatically the organization's coordinator.
    await gotoApp(page, '/organizations');
    await expect(page.locator(`text=${ORG_NAME}`).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'View', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: ORG_NAME }).first()).toBeVisible({
      timeout: 15_000
    });

    await page.getByRole('link', { name: 'Edit Organization' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Organization' })).toBeVisible({
      timeout: 15_000
    });

    const locationInput = page.locator('input[name="location"]');
    await expect(locationInput).toHaveValue('Test City', { timeout: 15_000 });
    await locationInput.fill(ORG_LOCATION_EDITED);
    await page.getByRole('button', { name: 'Save Organization' }).click();

    // Re-open the detail page and confirm the change rendered.
    await gotoApp(page, '/organizations');
    await page.getByRole('button', { name: 'View', exact: true }).first().click();
    await expect(page.locator(`text=${ORG_LOCATION_EDITED}`).first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('organizations status history records the approval', async ({ page }) => {
    await gotoApp(page, '/admin/organizations/status-history');

    await expect(
      page.getByRole('heading', { name: 'Organizations Status History' })
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('text=accepted').first()).toBeVisible({ timeout: 15_000 });
  });
});
