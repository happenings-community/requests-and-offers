import { test, expect } from '@playwright/test';
import { encodeHashToBase64, type AppWebsocket, type Record as HcRecord } from '@holochain/client';
import {
  gotoApp,
  createTestClient,
  closeTestClient,
  ensureAcceptedUser,
  ensureServiceType,
  callZome
} from '../utils/e2e-helpers.js';

// ============================================================================
// 09 — EXCHANGES
//
// One agent per run, so this covers what one member sees: their empty
// dashboard, the author's side of the interest block on a listing they own,
// and a typed timeframe (#380) going from the client through the real zome
// and back to the page. The two-party handshake, proposal, counter,
// acceptance, completion and review is exercised by the exchanges and
// timeframes sweettests and walked by hand on two agents; what the propose
// and counter pages send is pinned by their unit tests.
// ============================================================================

const DAY_MICROS = 24 * 60 * 60 * 1_000_000;

/** A request as the requests zome takes it, with the #380 fields given. */
function requestWith(title: string, figures: { timeframe: unknown; time_estimate_hours?: string }) {
  return {
    title,
    description: 'A request written by the exchanges e2e spec with a typed timeframe.',
    contact_preference: 'Email',
    timeframe: figures.timeframe,
    time_estimate_hours: figures.time_estimate_hours ?? null,
    amount: null,
    time_preference: 'NoPreference',
    time_zone: 'Europe/London',
    interaction_type: 'Virtual',
    links: []
  };
}

test.describe.serial('09 — exchanges', () => {
  let client: AppWebsocket;

  test.beforeAll(async () => {
    client = await createTestClient();
    await ensureAcceptedUser(client);
  });

  test.afterAll(async () => {
    await closeTestClient(client);
  });

  test('my exchanges renders its three groups and the empty state', async ({ page }) => {
    await gotoApp(page, '/exchanges');

    await expect(page.getByRole('heading', { name: 'My Exchanges', exact: true })).toBeVisible({
      timeout: 15_000
    });
    // Toggle buttons, not tabs: they filter the one list below rather than each owning a
    // panel. The two tabs on this page are Exchanges and Interested in.
    const groups = page.getByRole('group', { name: 'Exchange groups' });
    for (const group of ['Proposals', 'Active', 'Completed', 'All']) {
      await expect(groups.getByRole('button', { name: new RegExp(group) })).toBeVisible();
    }
    await expect(page.getByRole('tab', { name: /Exchanges/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByText('No active exchanges yet.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Browse listings to start one' })).toBeVisible();
  });

  test('the author of a listing sees who is interested, not the interest button', async ({
    page
  }) => {
    // A listing names one service type, so make sure one exists to name.
    const approved = (await callZome(
      client,
      'service_types',
      'get_approved_service_types',
      null
    )) as HcRecord[];
    const serviceTypeHash =
      approved.length > 0
        ? approved[0].signed_action.hashed.hash
        : (
            (await callZome(client, 'service_types', 'create_service_type', {
              service_type: {
                name: 'E2E Service Type',
                description: 'Created by the exchanges e2e spec',
                technical: false
              }
            })) as HcRecord
          ).signed_action.hashed.hash;

    // The offers spec archives or removes what it makes, so make one here.
    const created = (await callZome(client, 'offers', 'create_offer', {
      offer: {
        title: 'E2E Exchange Listing',
        description: 'A listing whose author looks for interested members.',
        time_preference: 'NoPreference',
        time_zone: 'Europe/London',
        interaction_type: 'Virtual',
        links: []
      },
      organization: null,
      service_type_hash: serviceTypeHash,
      medium_of_exchange_hashes: []
    })) as HcRecord;
    const hash = encodeHashToBase64(created.signed_action.hashed.hash);
    await gotoApp(page, `/offers/${hash}`);

    await expect(page.getByRole('heading', { name: 'Interested members' })).toBeVisible({
      timeout: 15_000
    });
    await expect(page.getByText('No one has registered interest yet.')).toBeVisible();
    // The door's own control, which an author never sees on their own listing. Named by
    // its test id rather than its words, so a copy review cannot quietly disable this
    // check by rewording the button.
    await expect(page.getByTestId('show-interest')).toHaveCount(0);
  });

  test('a typed timeframe and estimate go through the zome and read back as written', async ({
    page
  }) => {
    const serviceTypeHash = await ensureServiceType(client, 'E2E Timeframes');
    const end = Date.now() * 1000 + 7 * DAY_MICROS;
    const windowed = (await callZome(client, 'requests', 'create_request', {
      request: requestWith('E2E Windowed Request', {
        timeframe: { Dates: { start: null, end } },
        time_estimate_hours: '2.5'
      }),
      organization: null,
      service_type_hash: serviceTypeHash,
      medium_of_exchange_hashes: []
    })) as HcRecord;
    await gotoApp(page, `/requests/${encodeHashToBase64(windowed.signed_action.hashed.hash)}`);

    await expect(page.getByRole('heading', { name: 'Timeframe' })).toBeVisible({ timeout: 15_000 });
    // The page prints the end in the app's one date format (utils/dates.ts: "1 Dec 2026",
    // English whatever the browser's language) in the browser's own time zone, so ask the
    // browser for that day rather than assuming a zone.
    const byEnd = await page.evaluate(
      (micros) =>
        `by ${new Date(micros / 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      end
    );
    await expect(page.getByText(byEnd, { exact: true })).toBeVisible();
    await expect(page.getByText('2.5 hours', { exact: true })).toBeVisible();

    const preset = (await callZome(client, 'requests', 'create_request', {
      request: requestWith('E2E Preset Request', { timeframe: { Preset: 'WithinAFewDays' } }),
      organization: null,
      service_type_hash: serviceTypeHash,
      medium_of_exchange_hashes: []
    })) as HcRecord;
    await gotoApp(page, `/requests/${encodeHashToBase64(preset.signed_action.hashed.hash)}`);
    await expect(page.getByText('Within a few days of agreeing', { exact: true })).toBeVisible({
      timeout: 15_000
    });
  });

  test('a window that has already ended is refused by the zome, by name', async () => {
    const serviceTypeHash = await ensureServiceType(client, 'E2E Timeframes');
    const write = callZome(client, 'requests', 'create_request', {
      request: requestWith('E2E Ended Request', {
        timeframe: { Dates: { start: null, end: Date.now() * 1000 - DAY_MICROS } }
      }),
      organization: null,
      service_type_hash: serviceTypeHash,
      medium_of_exchange_hashes: []
    });
    await expect(write).rejects.toThrow(/a timeframe must end after the moment it is written/);
  });
});
