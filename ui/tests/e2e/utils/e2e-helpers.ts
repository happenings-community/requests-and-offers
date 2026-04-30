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

  if (!appPort || !token) {
    throw new Error(
      '[e2e] HC_APP_PORT or HC_APP_TOKEN not set. ' +
        'Make sure globalSetup ran successfully.'
    );
  }

  const params = new URLSearchParams({ hcPort: appPort, hcToken: token });
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
  const connectingLocator = page.locator('[data-testid="connecting-overlay"], text=Connecting to Holochain');
  try {
    await expect(connectingLocator.first()).toBeHidden({ timeout: timeoutMs });
  } catch {
    // Not present is also fine — connection might be instant
  }
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
    payload,
  });
}
