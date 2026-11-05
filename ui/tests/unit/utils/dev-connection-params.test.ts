import { describe, it, expect } from 'vitest';
import {
  DEV_CONNECTION_STORAGE_KEY,
  resolveDevConnectionParams
} from '$lib/utils/dev-connection-params';

// A Storage stand-in: sessionStorage is per tab and per origin, so each test's
// map plays one member's tab.
function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value)
  };
}

const URL_A = '?hcPort=35689&hcToken=dG9rZW4tYQ%3D%3D&hcAdminPort=56101';
const STORED_A = JSON.stringify({ hcPort: '35689', hcToken: 'dG9rZW4tYQ==', hcAdminPort: '56101' });

describe('resolveDevConnectionParams', () => {
  it('reads the params from the URL and stores them for the next load', () => {
    const storage = memoryStorage();
    expect(resolveDevConnectionParams(URL_A, storage)).toEqual({
      hcPort: '35689',
      hcToken: 'dG9rZW4tYQ==',
      hcAdminPort: '56101'
    });
    expect(JSON.parse(storage.map.get(DEV_CONNECTION_STORAGE_KEY)!)).toEqual(JSON.parse(STORED_A));
  });

  it('reads the stored params on a load whose URL has none, such as a reload on /offers', () => {
    const storage = memoryStorage({ [DEV_CONNECTION_STORAGE_KEY]: STORED_A });
    expect(resolveDevConnectionParams('', storage)).toEqual({
      hcPort: '35689',
      hcToken: 'dG9rZW4tYQ==',
      hcAdminPort: '56101'
    });
  });

  it('lets a param in the URL win over the stored one, and stores the new one', () => {
    const storage = memoryStorage({ [DEV_CONNECTION_STORAGE_KEY]: STORED_A });
    const fresh = resolveDevConnectionParams('?hcPort=40000&hcToken=bmV3', storage);
    expect(fresh).toEqual({ hcPort: '40000', hcToken: 'bmV3', hcAdminPort: null });
    expect(JSON.parse(storage.map.get(DEV_CONNECTION_STORAGE_KEY)!).hcPort).toBe('40000');
  });

  it('returns null with neither URL params nor stored ones, so the standalone branch still runs', () => {
    expect(resolveDevConnectionParams('', memoryStorage())).toBeNull();
    expect(resolveDevConnectionParams('?other=1', null)).toBeNull();
  });

  it('ignores a URL with a port but no token, and a stored value that is not valid', () => {
    expect(resolveDevConnectionParams('?hcPort=35689', memoryStorage())).toBeNull();
    const broken = memoryStorage({ [DEV_CONNECTION_STORAGE_KEY]: '{not json' });
    expect(resolveDevConnectionParams('', broken)).toBeNull();
    const partial = memoryStorage({
      [DEV_CONNECTION_STORAGE_KEY]: JSON.stringify({ hcPort: '1' })
    });
    expect(resolveDevConnectionParams('', partial)).toBeNull();
  });

  it('still connects from the URL when storage throws (private window, blocked site data)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      }
    };
    expect(resolveDevConnectionParams(URL_A, throwing)?.hcPort).toBe('35689');
    expect(resolveDevConnectionParams('', throwing)).toBeNull();
  });
});
