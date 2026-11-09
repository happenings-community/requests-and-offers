/**
 * Pure pieces of `bun start:web` (scripts/start-web.mts), kept apart so they are
 * unit-tested without a conductor. See documentation/guides/web-dev-mode.md.
 */

export const BASE_APP_ID = 'requests_and_offers';
export const MAX_AGENTS = 26;

export type WebDevConfig = {
  agents: number;
  uiPort: number;
  /** Picked free at start when not set. */
  adminPort: number | undefined;
  /** Picked free at start when not set. */
  bootstrapPort: number | undefined;
  /** The inspector page; picked free at start when not set. */
  inspectorPort: number | undefined;
};

type Env = Record<string, string | undefined>;

function port(env: Env, name: string): number | undefined {
  const raw = env[name];
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`${name} must be a port number between 1 and 65535, got "${raw}"`);
  }
  return n;
}

export function parseWebDevConfig(env: Env): WebDevConfig {
  const rawAgents = env.AGENTS ?? '2';
  const agents = Number(rawAgents);
  if (!Number.isInteger(agents) || agents < 1 || agents > MAX_AGENTS) {
    throw new Error(`AGENTS must be a whole number from 1 to ${MAX_AGENTS}, got "${rawAgents}"`);
  }
  return {
    agents,
    uiPort: port(env, 'UI_PORT') ?? 8880,
    adminPort: port(env, 'ADMIN_PORT'),
    bootstrapPort: port(env, 'BOOTSTRAP_PORT'),
    inspectorPort: port(env, 'INSPECTOR_PORT')
  };
}

/** Member 0 keeps the usual app id; the others are lettered: _b, _c, ... */
export function appIdFor(index: number): string {
  if (index === 0) return BASE_APP_ID;
  return `${BASE_APP_ID}_${String.fromCharCode('a'.charCodeAt(0) + index)}`;
}

/**
 * localhost and 127.0.0.1 are two origins for the browser, so the first two
 * members keep separate storage even in one browser profile. Members past the
 * second share localhost and need a profile of their own.
 */
export function hostFor(index: number): string {
  return index === 1 ? '127.0.0.1' : 'localhost';
}

/** The URL HolochainClientService connects from (hcPort, hcToken, hcAdminPort). */
export function memberUrl(p: {
  host: string;
  uiPort: number;
  appPort: number;
  token: string;
  adminPort: number;
}): string {
  const params = new URLSearchParams({
    hcPort: String(p.appPort),
    hcToken: p.token,
    hcAdminPort: String(p.adminPort)
  });
  return `http://${p.host}:${p.uiPort}/?${params.toString()}`;
}

/** An app token as HolochainClientService decodes it: base64 of the bytes. */
export function encodeToken(token: number[]): string {
  return btoa(String.fromCharCode(...token));
}

/** One conductor, discovered only through the local bootstrap server. */
export function sandboxCreateArgs(root: string, bootstrapUrl: string): string[] {
  return ['sandbox', '--piped', 'create', '--root', root, 'network', '-b', bootstrapUrl, 'mem'];
}

/**
 * The admin port must be given at run time: `hc sandbox run` rewrites the
 * port saved in the conductor config to 0 before starting.
 */
export function sandboxRunArgs(adminPort: number): string[] {
  return ['sandbox', `-f=${adminPort}`, '--piped', 'run', '--all'];
}

/**
 * Short and per admin port: lair's socket (<dir>/<id>/ks/socket) must fit in
 * SUN_LEN, and two stacks, or this and the e2e suite (/tmp/rao-e2e), must not
 * share a sandbox.
 */
export function workdirFor(adminPort: number): string {
  return `/tmp/rao-web-${adminPort}`;
}

/**
 * The command that opens a URL in the default browser, with the URL appended;
 * null where the platform has none, in which case nothing is opened.
 */
export function openCommand(platform: string): string[] | null {
  if (platform === 'linux') return ['xdg-open'];
  if (platform === 'darwin') return ['open'];
  if (platform === 'win32') return ['cmd', '/c', 'start', ''];
  return null;
}

/** `ADMIN_PORTS` as `bun start` sets it, "41001,41002": the ports, in order; anything else throws. */
export function parsePortList(raw: string | undefined): number[] {
  if (!raw || !raw.trim()) return [];
  return raw.split(',').map((part) => {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`ADMIN_PORTS must list port numbers, got "${raw}"`);
    return n;
  });
}
