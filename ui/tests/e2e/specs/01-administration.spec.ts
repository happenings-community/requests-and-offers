import { test, expect } from '@playwright/test';
import { gotoApp, createTestClient, ensureAcceptedUser } from '../utils/e2e-helpers.js';
import type { AppWebsocket } from '@holochain/client';

// ============================================================================
// 01 — ADMINISTRATION
//
// The agent (network administrator since onboarding) exercises the admin
// surfaces: dashboard stats, user management, a full suspend → unsuspend
// moderation round-trip through the ActionBar modals, the administrators
// page, and the status-history audit trail.
//
// INVARIANT: the primary user must END this file in "accepted" status —
// every later spec depends on it. The round-trip restores it, and afterAll
// re-asserts it through ensureAcceptedUser as a safety net even if a test
// in the middle failed.
// ============================================================================

test.describe.serial('01 — administration: moderation and audit surfaces', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
  });

  test.afterAll(async () => {
    // Safety net: whatever happened above, later spec files need an
    // accepted primary user.
    await ensureAcceptedUser(client);
    await client.client.close();
  });

  test('admin dashboard shows administration stats', async ({ page }) => {
    await gotoApp(page, '/admin');

    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.locator('text=Administrators').first()).toBeVisible();
    await expect(page.locator('text=Total Users').first()).toBeVisible();
    await expect(page.locator('text=Total Organizations').first()).toBeVisible();
  });

  test('users management lists the accepted user', async ({ page }) => {
    await gotoApp(page, '/admin/users');

    await expect(page.getByRole('heading', { name: 'Users Management' })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByRole('heading', { name: /Accepted Users \(1\)/ })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByRole('button', { name: 'View Profile' }).first()).toBeVisible();
  });

  test('admin suspends the user temporarily through the details modal', async ({ page }) => {
    await gotoApp(page, '/admin/users');
    await expect(page.getByRole('heading', { name: /Accepted Users \(1\)/ })).toBeVisible({
      timeout: 30_000
    });

    // Only one user exists in the sandbox, so the first View Profile button
    // is unambiguous. It opens the UserDetailsModal with the ActionBar.
    await page.getByRole('button', { name: 'View Profile' }).first().click();
    await expect(page.locator('text=@e2e_tester').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Suspend Temporarily' }).click();

    // PromptModal: reason + number of days.
    await expect(
      page.locator('text=What is the reason and duration of suspension').first()
    ).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder('Enter a reason').fill('E2E moderation round-trip');
    await page.getByPlaceholder('Number of days').fill('1');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.locator('text=User status updated successfully.').first()).toBeVisible({
      timeout: 10_000
    });
    await expect(page.getByRole('heading', { name: /Temporarily Suspended Users \(1\)/ })).toBeVisible(
      { timeout: 15_000 }
    );
  });

  test('admin unsuspends the user, restoring accepted status', async ({ page }) => {
    await gotoApp(page, '/admin/users');
    await expect(page.getByRole('heading', { name: /Temporarily Suspended Users \(1\)/ })).toBeVisible(
      { timeout: 30_000 }
    );

    await page.getByRole('button', { name: 'View Profile' }).first().click();
    await expect(page.locator('text=@e2e_tester').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Unsuspend', exact: true }).click();
    await expect(
      page.locator('text=Are you sure you want to unsuspend this user?').first()
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(page.locator('text=User status updated successfully.').first()).toBeVisible({
      timeout: 10_000
    });
    await expect(page.getByRole('heading', { name: /Accepted Users \(1\)/ })).toBeVisible({
      timeout: 15_000
    });
  });

  test('administrators page lists the network administrator', async ({ page }) => {
    await gotoApp(page, '/admin/administrators');

    await expect(page.getByRole('heading', { name: 'Administrators management' })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByRole('button', { name: 'Add administrator' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'View Profile' }).first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('status history records the moderation transitions', async ({ page }) => {
    await gotoApp(page, '/admin/users/status-history');

    await expect(page.getByRole('heading', { name: 'Status History' })).toBeVisible({
      timeout: 30_000
    });
    // The suspend step recorded its reason; the unsuspend restored accepted.
    await expect(page.locator('text=E2E moderation round-trip').first()).toBeVisible({
      timeout: 15_000
    });
    await expect(page.locator('text=accepted').first()).toBeVisible();
  });
});
