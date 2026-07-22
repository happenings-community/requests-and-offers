import { test, expect, type Page } from '@playwright/test';
import type { AppWebsocket } from '@holochain/client';
import { gotoApp, createTestClient, ensureAcceptedUser } from '../utils/e2e-helpers.js';

// ============================================================================
// SMOKE
//
// A fast health check across the whole app: every core route must mount
// against the live conductor without crashing. This is the "is the app
// fundamentally broken?" signal — a broken build, a routing regression, a
// failed Holochain connection, or a page that throws on mount all surface
// here in seconds, without paying for the full 5.5-minute journey.
//
// Run just this layer with `bun test:e2e:smoke` (grep '@smoke').
//
// ORDERING: this file is UNNUMBERED on purpose. Playwright runs spec files in
// filename order, and letters sort AFTER digits, so smoke executes LAST in a
// full run — after 00-onboarding has already created and accepted the primary
// user. That keeps 00's fresh-conductor assumptions intact. Standalone (or via
// grep on a freshly-wiped sandbox) it seeds its own accepted user through the
// idempotent ensureAcceptedUser helper, so it never depends on ordering.
//
// SCOPE: shallow by design. It asserts each route renders a durable landmark
// (heading / tab label) and does NOT render a failure banner. Deep CRUD flows
// belong to the numbered chapters; multi-agent flows to Sweettest.
// ============================================================================

/** A durable landmark that proves a route mounted. */
type SmokeRoute = {
  path: string;
  /** Accessible heading name expected on the page, matched exactly, or... */
  heading?: string;
  /** ...an arbitrary durable text landmark when the page has no stable heading. */
  landmark?: string;
};

// The accepted primary user is also the network administrator (the first agent
// in a sandbox auto-registers as admin, see ensureAcceptedUser), so the admin
// surfaces below are reachable with the same identity.
//
// Every landmark below is the literal heading in that route's +page.svelte, not a
// guess: '/users' renders its title as an <h2> styled .h1, and the offers and
// requests tabs carry an emoji prefix ('📋 Active Offers'), which is why those two
// match on text rather than on an accessible name.
const SMOKE_ROUTES: SmokeRoute[] = [
  { path: '/', heading: 'Welcome to Requests & Offers' },
  { path: '/service-types', heading: 'Available Service Types' },
  { path: '/offers', landmark: 'Active Offers' },
  { path: '/requests', landmark: 'Active Requests' },
  { path: '/organizations', heading: 'Organizations' },
  { path: '/users', heading: 'Users' },
  { path: '/admin', heading: 'Admin Dashboard' },
  { path: '/admin/hrea-test', heading: 'hREA Test Interface' }
];

/**
 * Asserts the app never rendered one of its terminal failure states. The root
 * layout shows "Failed to connect" if the Holochain connection dies; the admin
 * layout shows "Admin data loading failed" if an admin data load throws.
 */
async function expectNoFailureState(page: Page): Promise<void> {
  // .first() keeps these strict-mode safe: a bare text= locator throws rather than
  // asserting if the phrase ever appears twice, and on an empty match .first()
  // still resolves to hidden, which is the answer we want.
  await expect(page.locator('text=Failed to connect').first()).toBeHidden();
  await expect(page.locator('text=Admin data loading failed').first()).toBeHidden();
}

test.describe.serial('smoke — every core route mounts against the live conductor', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
  });

  test.afterAll(async () => {
    await client.client.close();
  });

  for (const route of SMOKE_ROUTES) {
    test(`@smoke ${route.path} mounts`, async ({ page }) => {
      await gotoApp(page, route.path);

      if (route.heading) {
        // exact: true so 'Users' cannot be satisfied by 'Users Management', and
        // .first() because some pages repeat a heading name in cards below the
        // title, which a bare strict locator would reject.
        await expect(
          page.getByRole('heading', { name: route.heading, exact: true }).first()
        ).toBeVisible({ timeout: 30_000 });
      }
      if (route.landmark) {
        await expect(page.locator(`text=${route.landmark}`).first()).toBeVisible({
          timeout: 30_000
        });
      }

      await expectNoFailureState(page);
    });
  }
});
