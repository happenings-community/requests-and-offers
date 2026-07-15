import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { readTestEnv, createZomeClient } from '../../setup/conductor-manager.js';
import type { AppWebsocket } from '@holochain/client';

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
