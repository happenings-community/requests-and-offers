/**
 * The conductor address a dev launcher hands the app in its URL (`bun start:web`,
 * the e2e harness): hcPort, hcToken and, optionally, hcAdminPort.
 *
 * The URL only carries them on the first load. Any in-app navigation drops the
 * query, so a reload on /offers would find none and fall back to the standalone
 * branch, which cannot connect. So the first load stores them in the tab's
 * sessionStorage and a load without them reads them back. sessionStorage is per
 * tab and per origin, which keeps two members' tabs apart. A param in the URL
 * always wins, so opening a member's printed URL again replaces what is stored.
 */

export const DEV_CONNECTION_STORAGE_KEY = 'rao:dev-connection';

export type DevConnectionParams = {
  hcPort: string;
  hcToken: string;
  hcAdminPort: string | null;
};

type ParamStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function fromUrl(search: string): DevConnectionParams | null {
  const params = new URLSearchParams(search);
  const hcPort = params.get('hcPort');
  const hcToken = params.get('hcToken');
  if (!hcPort || !hcToken) return null;
  return { hcPort, hcToken, hcAdminPort: params.get('hcAdminPort') };
}

function fromStorage(storage: ParamStorage | null): DevConnectionParams | null {
  try {
    const raw = storage?.getItem(DEV_CONNECTION_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { hcPort, hcToken, hcAdminPort } = value as Record<string, unknown>;
    if (typeof hcPort !== 'string' || !hcPort || typeof hcToken !== 'string' || !hcToken)
      return null;
    return { hcPort, hcToken, hcAdminPort: typeof hcAdminPort === 'string' ? hcAdminPort : null };
  } catch {
    return null;
  }
}

/** URL first, then what this tab stored, else null (the standalone branch). */
export function resolveDevConnectionParams(
  search: string,
  storage: ParamStorage | null
): DevConnectionParams | null {
  const url = fromUrl(search);
  if (url) {
    try {
      storage?.setItem(DEV_CONNECTION_STORAGE_KEY, JSON.stringify(url));
    } catch {
      // Storage blocked: this load still connects, a reload will not.
    }
    return url;
  }
  return fromStorage(storage);
}

/** The tab's sessionStorage, or null where it is missing or blocked. */
export function tabStorage(): ParamStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
