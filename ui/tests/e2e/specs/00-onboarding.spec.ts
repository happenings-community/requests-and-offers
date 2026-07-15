import { test, expect } from '@playwright/test';
import { gotoApp, waitForConnection, createTestClient } from '../utils/e2e-helpers.js';
import type { AppWebsocket } from '@holochain/client';

// ============================================================================
// 00 — ONBOARDING
//
// The whole e2e suite is one ordered single-agent journey (global-setup
// starts ONE conductor for the run; spec files execute in filename order
// with workers: 1). This file is the journey's opening chapter and the ONLY
// place the agent's profile is created THROUGH THE REAL UI FORM — every
// later spec file bootstraps through the idempotent ensureAcceptedUser()
// helper instead, so it can also run standalone.
//
// Flow: connect → create-profile CTA → gated marketplace → create profile
// via /user/create → pending gate → self-approve from the admin dashboard
// (the first user auto-registers as network administrator, see
// users_organizations::create_user) → gate lifts → edit profile via UI.
// ============================================================================

test.describe.serial('00 — onboarding: from visitor to accepted member', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  test('app loads and connects to conductor', async ({ page }) => {
    await gotoApp(page, '/');

    await expect(page.locator('text=Failed to connect')).toBeHidden({ timeout: 15_000 });
    await expect(page).toHaveURL(/localhost:\d+/);
  });

  test('home page invites a new visitor to create a profile', async ({ page }) => {
    await gotoApp(page, '/');

    // A fresh conductor has no profile — the home page shows the "Join the
    // Community" card with a Create Profile call to action.
    await expect(page.getByRole('link', { name: /Create Profile/i }).first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('offers list points profile-less visitors to profile creation', async ({ page }) => {
    await gotoApp(page, '/offers');

    await expect(page.getByRole('link', { name: /Create Profile to Make Offers/i })).toBeVisible({
      timeout: 15_000
    });
  });

  test('visitor creates a profile through the real form', async ({ page }) => {
    await gotoApp(page, '/user/create');

    await expect(page.getByRole('heading', { name: 'Create User Profile' })).toBeVisible({
      timeout: 15_000
    });

    await page.locator('input[name="given_name"]').fill('E2E');
    await page.locator('input[name="family_name"]').fill('Tester');
    // Keep the nickname aligned with DEFAULT_USER in e2e-helpers so
    // UI-created and zome-seeded profiles are interchangeable downstream.
    await page.locator('input[name="nickname"]').fill('e2e_tester');
    await page.locator('input[name="email"]').fill('e2e@example.com');
    // UserForm's TimeZoneSelect is a native <select> (unlike the offer and
    // request forms' popup combobox).
    await page.locator('select[name="timezone"]').selectOption('Europe/London');

    await page.getByRole('button', { name: 'Create Profile' }).click();

    // Success is announced in a Skeleton alert modal before redirecting.
    await expect(page.getByRole('heading', { name: /Welcome to hCRON!/i })).toBeVisible({
      timeout: 15_000
    });
    await page.getByRole('button', { name: /^Ok/ }).click();

    await expect(page).toHaveURL(/\/user(\?|$)/, { timeout: 15_000 });
    await expect(page.locator('text=e2e_tester').first()).toBeVisible({ timeout: 10_000 });
  });

  test('pending profile cannot create offers yet', async ({ page }) => {
    await gotoApp(page, '/offers');

    // ProfileGuard renders a disabled create control while the profile is
    // pending administrator approval.
    await expect(page.locator('text=Profile Approval Required').first()).toBeVisible({
      timeout: 15_000
    });
  });

  test('first agent approves its own profile from the admin dashboard', async ({ page }) => {
    // The first user auto-registered as network administrator, so the admin
    // dashboard's moderation queue is reachable and lists the pending user.
    await gotoApp(page, '/admin');

    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({
      timeout: 30_000
    });
    await expect(page.getByRole('button', { name: /Pending Users \(1\)/ })).toBeVisible({
      timeout: 15_000
    });

    await page.getByRole('button', { name: 'Approve' }).first().click();

    await expect(page.locator('text=User approved.').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=No pending users.')).toBeVisible({ timeout: 10_000 });
  });

  test('accepted profile can now create offers', async ({ page }) => {
    await gotoApp(page, '/offers');

    await expect(page.getByRole('button', { name: 'Create Offer', exact: true })).toBeVisible({
      timeout: 15_000
    });
  });

  test('user edits their profile through the form', async ({ page }) => {
    await gotoApp(page, '/user/edit');

    await expect(page.getByRole('heading', { name: 'Edit User' })).toBeVisible({
      timeout: 15_000
    });

    // The update button stays disabled until a field actually changes.
    await page.locator('input[name="location"]').fill('E2E Updated City');
    await page.getByRole('button', { name: 'Update Profile' }).click();

    await expect(page.locator('text=successfully updated').first()).toBeVisible({
      timeout: 15_000
    });
    await page.getByRole('button', { name: /^Ok/ }).click();

    await expect(page).toHaveURL(/\/user(\?|$)/, { timeout: 15_000 });
    await expect(page.locator('text=E2E Updated City').first()).toBeVisible({ timeout: 10_000 });
  });
});
