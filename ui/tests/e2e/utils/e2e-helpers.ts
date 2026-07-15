import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { readTestEnv, createZomeClient } from '../../setup/conductor-manager.js';
import type { AppWebsocket, Record as HolochainRecord } from '@holochain/client';
import { decode } from '@msgpack/msgpack';

const UI_PORT = process.env.E2E_UI_PORT ?? '8880';

/**
 * Builds the full URL for a route, including the ?hcPort=&hcToken= params
 * that HolochainClientService reads to connect to the conductor.
 *
 * This replicates exactly what hc-spin injects into browser windows.
 */
export function holochainUrl(path: string = '/'): string {
  const appPort = process.env.HC_APP_PORT;
  const token = process.env.HC_APP_TOKEN;
  const adminPort = process.env.HC_ADMIN_PORT;

  if (!appPort || !token) {
    throw new Error(
      '[e2e] HC_APP_PORT or HC_APP_TOKEN not set. ' + 'Make sure globalSetup ran successfully.'
    );
  }

  const params = new URLSearchParams({ hcPort: appPort, hcToken: token });
  // hcAdminPort triggers the e2e-only signing-credential authorization in
  // HolochainClientService — a plain browser (unlike hc-spin) has no host
  // signer, so without this every zome call fails with NoSigningCredentials.
  if (adminPort) params.set('hcAdminPort', adminPort);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `http://localhost:${UI_PORT}${cleanPath}?${params.toString()}`;
}

/**
 * Navigate to a route and wait for the Holochain connection to establish.
 * Always call this instead of page.goto() directly in e2e tests.
 */
export async function gotoApp(page: Page, path: string = '/'): Promise<void> {
  await page.goto(holochainUrl(path));
  await waitForConnection(page);
}

/**
 * Waits for the UI to finish connecting to the Holochain conductor.
 * The connection indicator disappears once AppWebsocket.connect() resolves.
 */
export async function waitForConnection(page: Page, timeoutMs = 20_000): Promise<void> {
  // Wait for any "connecting" spinner/overlay to disappear.
  // Adjust selectors to match your actual UI connection indicators.
  const connectingLocator = page.locator(
    '[data-testid="connecting-overlay"], text=Connecting to Holochain'
  );
  try {
    await expect(connectingLocator.first()).toBeHidden({ timeout: timeoutMs });
  } catch {
    // Not present is also fine — connection might be instant
  }
}

/**
 * Selects a time zone in the shared TimeZoneSelect combobox. Offer and request
 * forms both require a time zone (it has no default), so the submit button
 * stays disabled until one is chosen. Filters the combobox then clicks the
 * first matching option.
 */
export async function selectTimezone(page: Page, filter = 'Europe/London'): Promise<void> {
  // TimeZoneSelect is a Skeleton use:popup combobox. Its option list lives in a
  // popup that Skeleton keeps display:none until the input is focused, and it
  // hides again on blur — so clicking an <button role="option"> is unreliable
  // (the option is never "visible" to Playwright and the click times out).
  // Drive it purely by keyboard instead, keeping focus on the input the whole
  // time: click to focus+open, type to filter (pressSequentially fires real
  // per-char input events, unlike fill() which can blur), then ArrowDown+Enter.
  // The component's handleKeydown highlights the first match on ArrowDown and
  // commit()s it on Enter, writing the zone into the form's bound value.
  // NOTE: filter must be a zone Playwright's bundled Chromium actually returns
  // from Intl.supportedValuesOf('timeZone') — that build omits 'UTC' and the
  // 'Etc/*' aliases, so filtering for 'UTC' yields "No timezones match" and no
  // options. 'Europe/London' is present.
  const combobox = page.getByPlaceholder('Select timezone...');
  // Open the popup and filter. Type with the keyboard (not fill(), which blurs
  // the input and makes Skeleton hide the popup); this keeps focus and renders
  // the matching <button role="option"> entries. Dispatch the click straight at
  // the first match: Svelte's delegated handler fires handleItemClick ->
  // commit(), writing the zone into the form's bound value.
  await combobox.click();
  await combobox.pressSequentially(filter, { delay: 20 });
  await page.locator('button[role="option"]', { hasText: filter }).first().dispatchEvent('click');
  // Confirm the value actually committed (not just the typed search text). On
  // commit the input switches to the zone's display string, which includes the
  // UTC-offset suffix — e.g. "Europe/London (UTC+01:00)". The raw search text
  // never contains "(UTC", so this pattern is a reliable commit signal and is
  // form-agnostic (offer and request forms wire TimeZoneSelect differently).
  await expect(combobox).toHaveValue(/\(UTC/, { timeout: 5_000 });
}

/**
 * Creates an AppWebsocket client using the same token as the browser.
 * Data written via this client is immediately visible in the browser
 * because they share the same Holochain agent identity.
 */
export async function createTestClient(): Promise<AppWebsocket> {
  const { appPort, tokenBase64 } = readTestEnv();
  return createZomeClient(appPort, tokenBase64);
}

/**
 * Helper to call a zome function directly from test code (for seeding or assertions).
 */
export async function callZome(
  client: AppWebsocket,
  zomeName: string,
  fnName: string,
  payload: unknown,
  roleName: string = 'requests_and_offers'
): Promise<unknown> {
  return client.callZome({
    role_name: roleName,
    zome_name: zomeName,
    fn_name: fnName,
    payload
  });
}

// ============================================================================
// Idempotent seed / ensure helpers
//
// global-setup starts ONE conductor for the whole Playwright run, so every
// spec file shares the same agent identity and DHT state. Spec files execute
// in filename order (workers: 1), but each file must also be runnable on its
// own (`playwright test specs/04-offers.spec.ts`). These helpers make that
// possible: they create the state a spec depends on only if it doesn't exist
// yet, so they are safe to call from every beforeAll regardless of which
// files ran before.
// ============================================================================

/** Decodes the msgpack app entry out of a Holochain record, or null if absent. */
export function decodeRecordEntry<T>(record: HolochainRecord): T | null {
  const entry = (record.entry as { Present?: { entry?: Uint8Array } })?.Present?.entry;
  return entry ? (decode(entry) as T) : null;
}

export interface UserSeed {
  name: string;
  nickname: string;
  bio: string;
  profile_picture: null;
  user_type: string;
  skills: string[];
  email: string;
  phone: null;
  time_zone: string;
  location: string;
}

export const DEFAULT_USER: UserSeed = {
  name: 'E2E Test User',
  nickname: 'e2e_tester',
  bio: 'Created during automated e2e testing',
  profile_picture: null,
  user_type: 'advocate',
  skills: ['testing', 'playwright'],
  email: 'e2e@example.com',
  phone: null,
  time_zone: 'UTC',
  location: 'Test City'
};

/** Returns the agent's user original action hash, or null if no profile exists yet. */
export async function getAgentUserHash(client: AppWebsocket): Promise<Uint8Array | null> {
  const links = (await callZome(
    client,
    'users_organizations',
    'get_agent_user',
    client.myPubKey
  )) as Array<{ target: Uint8Array }>;
  return links.length > 0 ? links[0].target : null;
}

/**
 * Creates the agent's user profile via zome call unless one already exists
 * (users_organizations::create_user rejects a second call per agent).
 * Returns the user's original action hash either way.
 */
export async function ensureUser(
  client: AppWebsocket,
  overrides: Partial<UserSeed> = {}
): Promise<Uint8Array> {
  const existing = await getAgentUserHash(client);
  if (existing) return existing;
  const record = (await callZome(client, 'users_organizations', 'create_user', {
    ...DEFAULT_USER,
    ...overrides
  })) as HolochainRecord;
  return record.signed_action.hashed.hash;
}

/**
 * Guarantees the agent's profile exists AND is in "accepted" status.
 * The first user in the sandbox auto-registers as network administrator
 * (users_organizations::create_user), so it can accept its own profile.
 * ProfileGuard gates offer/request creation on accepted status.
 */
export async function ensureAcceptedUser(
  client: AppWebsocket,
  overrides: Partial<UserSeed> = {}
): Promise<Uint8Array> {
  const userHash = await ensureUser(client, overrides);

  const status = (await callZome(client, 'administration', 'get_latest_status_for_entity', {
    entity: 'users',
    entity_original_action_hash: userHash
  })) as { status_type: string } | null;
  if (status?.status_type === 'accepted') return userHash;

  // The status link target is the ORIGINAL status action; the latest record
  // is the tip. On a fresh profile they are the same hash, but resolving both
  // keeps this correct after suspend/unsuspend round-trips too.
  const statusLink = (await callZome(
    client,
    'users_organizations',
    'get_user_status_link',
    userHash
  )) as { target: Uint8Array } | null;
  const latestStatusRecord = (await callZome(
    client,
    'administration',
    'get_latest_status_record_for_entity',
    { entity: 'users', entity_original_action_hash: userHash }
  )) as HolochainRecord;
  const latestHash = latestStatusRecord.signed_action.hashed.hash;

  await callZome(client, 'administration', 'update_entity_status', {
    entity: 'users',
    entity_original_action_hash: userHash,
    status_original_action_hash: statusLink?.target ?? latestHash,
    status_previous_action_hash: latestHash,
    new_status: { status_type: 'accepted', reason: null, suspended_until: null }
  });
  return userHash;
}

/**
 * Returns the original action hash of an approved service type with this
 * exact name, creating it (admin path — auto-approved) if it doesn't exist.
 */
export async function ensureServiceType(
  client: AppWebsocket,
  name: string,
  opts: { description?: string; technical?: boolean } = {}
): Promise<Uint8Array> {
  const approved = (await callZome(
    client,
    'service_types',
    'get_approved_service_types',
    null
  )) as HolochainRecord[];
  const existing = approved.find((r) => decodeRecordEntry<{ name: string }>(r)?.name === name);
  if (existing) return existing.signed_action.hashed.hash;

  const record = (await callZome(client, 'service_types', 'create_service_type', {
    service_type: {
      name,
      description: opts.description ?? 'Seeded by e2e ensureServiceType',
      technical: opts.technical ?? false
    }
  })) as HolochainRecord;
  return record.signed_action.hashed.hash;
}

/**
 * Returns the original action hash of a medium of exchange with this exact
 * code, creating it (admin path — auto-approved) if it doesn't exist.
 */
export async function ensureMediumOfExchange(
  client: AppWebsocket,
  code: string,
  opts: { name?: string; description?: string; exchange_type?: string } = {}
): Promise<Uint8Array> {
  const all = (await callZome(
    client,
    'mediums_of_exchange',
    'get_all_mediums_of_exchange',
    null
  )) as HolochainRecord[];
  const existing = all.find((r) => decodeRecordEntry<{ code: string }>(r)?.code === code);
  if (existing) return existing.signed_action.hashed.hash;

  const record = (await callZome(client, 'mediums_of_exchange', 'create_medium_of_exchange', {
    medium_of_exchange: {
      code,
      name: opts.name ?? `E2E Medium ${code}`,
      description: opts.description ?? 'Seeded by e2e ensureMediumOfExchange',
      exchange_type: opts.exchange_type ?? 'currency',
      resource_spec_hrea_id: null
    }
  })) as HolochainRecord;
  return record.signed_action.hashed.hash;
}
