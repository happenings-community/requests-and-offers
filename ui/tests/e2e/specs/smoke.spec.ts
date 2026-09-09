import { test, expect, type Locator, type Page } from '@playwright/test';
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

/** Sentinel for the poll below: the route rendered what it should. */
const MOUNTED = 'mounted';

/**
 * Waits for a route to either mount its landmark or report a terminal failure,
 * whichever happens first, then asserts it mounted.
 *
 * Racing the two is the whole point. Asserting the landmark first and checking
 * the failure banner afterwards makes the banner check unreachable: when the
 * connection dies the landmark never appears, so the test times out on a
 * missing heading and never examines the banner. The check then only ever runs
 * on a page that already rendered, where it cannot fail.
 *
 * Verified by killing the conductor mid-suite. Before this change the page
 * showed "Failed to connect to Holochain" while the test reported `Active
 * Offers` not found. After it, the failure text is what the report names.
 */
async function expectRouteMounted(page: Page, landmark: Locator): Promise<void> {
  // The root layout renders the first phrase if the Holochain connection dies;
  // the admin layout renders the second if an admin data load throws.
  const failure = page.getByText(/Failed to connect|Admin data loading failed/).first();

  await expect
    .poll(
      async () => {
        if (await failure.isVisible()) return (await failure.innerText()).trim();
        if (await landmark.isVisible()) return MOUNTED;
        return 'still loading';
      },
      { timeout: 30_000 }
    )
    .toBe(MOUNTED);
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

      // exact: true so 'Users' cannot be satisfied by 'Users Management', and
      // .first() because some pages repeat a heading name in cards below the
      // title, which a bare strict locator would reject.
      const landmark = route.heading
        ? page.getByRole('heading', { name: route.heading, exact: true }).first()
        : page.locator(`text=${route.landmark}`).first();

      await expectRouteMounted(page, landmark);
    });
  }
});
