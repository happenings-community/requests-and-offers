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
    bootstrapPort: port(env, 'BOOTSTRAP_PORT')
  };
}

/** Member 0 keeps the usual app id; the others are lettered: _b, _c, ... */
export function appIdFor(index: number): string {
  if (index === 0) return BASE_APP_ID;
  return `${BASE_APP_ID}_${String.fromCharCode('a'.charCodeAt(0) + index)}`;
}

/** The URL HolochainClientService connects from (hcPort, hcToken, hcAdminPort). */
export function memberUrl(p: {
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
  return `http://localhost:${p.uiPort}/?${params.toString()}`;
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
