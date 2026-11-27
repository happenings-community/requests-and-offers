#!/usr/bin/env bun
/**
 * progenitor-steward.ts: the operator tool for the release's steward conductor.
 *
 * A release is keyed with a progenitor key (scripts/release-progenitor.ts), and
 * that key belongs to a headless conductor, the steward, that nobody uses as a
 * member. The steward creates its own profile, which makes it the network's
 * first administrator, then grants administrator to the team's desktop agents,
 * whose keys the wrapper generated at their install. documentation/progenitor.md
 * has the order and the commands for starting the conductor.
 *
 *   keygen    print a new agent key from a running conductor
 *   install   install the release .happ under that key and the release network seed
 *   grant     create the steward's profile if it has none, then make agents administrators
 *   status    what this conductor is, and who holds administrator
 *   update-profile  change the steward's own name, bio, email or picture
 *
 * Run it on the machine that runs the conductor: `install` hands the conductor a
 * file path. Needs `bun install` first (@holochain/client and @msgpack/msgpack
 * are the UI workspace's dependencies, hoisted to the root).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { parseArgs } from 'node:util';
import { isAgentPubKey, ROLE } from './release-progenitor.ts';

/** The origin the steward presents to the conductor's interfaces. */
export const STEWARD_ORIGIN = 'requests-and-offers-steward';
export const DEFAULT_APP_ID = 'requests_and_offers';
const NETWORK = 'network';

export type Connection = { adminPort: number; installedAppId: string; appPort?: number };

export type Command =
  | { kind: 'help' }
  | ({ kind: 'keygen'; dryRun: boolean } & Pick<Connection, 'adminPort'>)
  | ({
      kind: 'install';
      dryRun: boolean;
      happ: string;
      agentKey: string;
      networkSeed: string;
    } & Pick<Connection, 'adminPort' | 'installedAppId' | 'appPort'>)
  | ({
      kind: 'grant';
      dryRun: boolean;
      agents: string[];
      profile: Profile;
      waitSeconds: number;
    } & Connection)
  | ({ kind: 'status'; dryRun: boolean; agents: string[] } & Connection)
  | ({ kind: 'update-profile'; dryRun: boolean; changes: ProfileChanges } & Connection);

export type Profile = { name: string; email: string };

/** What `update-profile` changes; a field left out keeps its current value. `picture` is a file path. */
export type ProfileChanges = { name?: string; bio?: string; email?: string; picture?: string };

export type Parsed = { ok: true; command: Command } | { ok: false; message: string };

/** The largest picture `update-profile` sends. The zome only checks it decodes as an image. */
export const MAX_PICTURE_KIB = 512;

export const USAGE = `usage: bun scripts/progenitor-steward.ts <command> [options]

commands
  keygen                         print a new agent key (base64) from the conductor
  install --happ <file> --agent-key <key> --network-seed <seed>
                                 install the release hApp under that key and seed, enable it,
                                 attach an app interface
  grant [--agent <key> ...]      as the progenitor: create the steward profile if there is none,
                                 then make each agent an administrator (no --agent: profile only)
  status [--agent <key> ...]     app state, progenitor check, and every member with their agent key
  update-profile [--name <name>] [--bio <text>] [--email <email>] [--picture <file>]
                                 as the progenitor: change the steward's own profile (at least one),
                                 which members see in the member list and as an administrator contact;
                                 the name sets the nickname too, the picture is a PNG, JPEG, GIF or WebP
                                 of at most ${MAX_PICTURE_KIB} KiB

options for every command
  --admin-port <port>   the conductor's admin websocket on 127.0.0.1 (default 4444, env HC_ADMIN_PORT)
  --app-id <id>         installed app id (default ${DEFAULT_APP_ID})
  --app-port <port>     app interface port (install: the port to attach; others: the one to use)
  --dry-run             print what would be done, connect to nothing
  -h, --help

grant options
  --name <name>         steward profile name (default Steward)
  --email <email>       steward profile email (default steward@example.org)
  --wait <seconds>      how long to wait for an agent's profile to reach the steward (default 60)`;

const port = (value: string | undefined, label: string): number | string => {
  if (value === undefined) return `missing ${label}`;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : `${label} must be a port number, got ${JSON.stringify(value)}`;
};

export const parseCommand = (argv: string[], env: Record<string, string | undefined> = {}): Parsed => {
  const [name, ...rest] = argv;
  if (name === undefined || name === '-h' || name === '--help' || name === 'help') {
    return { ok: true, command: { kind: 'help' } };
  }
  if (!['keygen', 'install', 'grant', 'status', 'update-profile'].includes(name)) {
    return { ok: false, message: `unknown command ${JSON.stringify(name)}` };
  }

  let values: Record<string, string | boolean | string[] | undefined>;
  try {
    values = parseArgs({
      args: rest,
      options: {
        'admin-port': { type: 'string' },
        'app-id': { type: 'string' },
        'app-port': { type: 'string' },
        'dry-run': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        happ: { type: 'string' },
        'agent-key': { type: 'string' },
        'network-seed': { type: 'string' },
        agent: { type: 'string', multiple: true },
        name: { type: 'string' },
        email: { type: 'string' },
        bio: { type: 'string' },
        picture: { type: 'string' },
        wait: { type: 'string' }
      },
      strict: true
    }).values;
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
  if (values.help) return { ok: true, command: { kind: 'help' } };

  // One option table serves every command, so a flag that belongs to another command is refused
  // here rather than silently ignored: `grant --picture` must not look as if it set a picture.
  const common = ['admin-port', 'app-id', 'app-port', 'dry-run', 'help'];
  const allowed: Record<string, string[]> = {
    keygen: [],
    install: ['happ', 'agent-key', 'network-seed'],
    grant: ['agent', 'name', 'email', 'wait'],
    status: ['agent'],
    'update-profile': ['name', 'bio', 'email', 'picture']
  };
  const stray = Object.keys(values).find((flag) => !common.includes(flag) && !allowed[name].includes(flag));
  if (stray !== undefined) return { ok: false, message: `--${stray} does not apply to ${name}` };

  const adminPort = port((values['admin-port'] as string | undefined) ?? env.HC_ADMIN_PORT ?? '4444', '--admin-port');
  if (typeof adminPort === 'string') return { ok: false, message: adminPort };
  let appPort: number | undefined;
  if (values['app-port'] !== undefined) {
    const parsed = port(values['app-port'] as string, '--app-port');
    if (typeof parsed === 'string') return { ok: false, message: parsed };
    appPort = parsed;
  }
  const installedAppId = (values['app-id'] as string | undefined) ?? DEFAULT_APP_ID;
  const dryRun = values['dry-run'] === true;
  const agents = (values.agent as string[] | undefined) ?? [];
  const badAgent = agents.find((a) => !isAgentPubKey(a));
  if (badAgent !== undefined) {
    return { ok: false, message: `--agent ${JSON.stringify(badAgent)} is not an AgentPubKey: it starts with 'uhCAk' and is 53 characters` };
  }

  switch (name) {
    case 'keygen':
      return { ok: true, command: { kind: 'keygen', dryRun, adminPort } };
    case 'install': {
      const happ = values.happ as string | undefined;
      const agentKey = values['agent-key'] as string | undefined;
      const networkSeed = values['network-seed'] as string | undefined;
      if (!happ) return { ok: false, message: 'install needs --happ <file>' };
      if (!agentKey || !isAgentPubKey(agentKey)) {
        return { ok: false, message: "install needs --agent-key <key>: an AgentPubKey starting 'uhCAk', 53 characters (from `keygen`)" };
      }
      if (!networkSeed) return { ok: false, message: 'install needs --network-seed <seed> (desktop.networkSeed in release-manifest.json)' };
      return { ok: true, command: { kind: 'install', dryRun, adminPort, installedAppId, appPort, happ, agentKey, networkSeed } };
    }
    case 'grant': {
      const wait = Number((values.wait as string | undefined) ?? '60');
      if (!Number.isFinite(wait) || wait < 0) return { ok: false, message: '--wait must be a number of seconds' };
      return {
        ok: true,
        command: {
          kind: 'grant',
          dryRun,
          adminPort,
          installedAppId,
          appPort,
          agents: [...new Set(agents)],
          profile: {
            name: (values.name as string | undefined) ?? 'Steward',
            email: (values.email as string | undefined) ?? 'steward@example.org'
          },
          waitSeconds: wait
        }
      };
    }
    case 'update-profile': {
      const changes: ProfileChanges = {};
      for (const field of ['name', 'bio', 'email', 'picture'] as const) {
        const raw = values[field] as string | undefined;
        if (raw === undefined) continue;
        const value = field === 'bio' ? raw : raw.trim();
        if (field !== 'bio' && value === '') return { ok: false, message: `--${field} must not be empty` };
        changes[field] = value;
      }
      if (changes.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) {
        return { ok: false, message: `--email ${JSON.stringify(changes.email)} is not an email address` };
      }
      if (Object.keys(changes).length === 0) {
        return { ok: false, message: 'update-profile needs at least one of --name, --bio, --email, --picture' };
      }
      return { ok: true, command: { kind: 'update-profile', dryRun, adminPort, installedAppId, appPort, changes } };
    }
    default:
      return { ok: true, command: { kind: 'status', dryRun, adminPort, installedAppId, appPort, agents: [...new Set(agents)] } };
  }
};

// ---------------------------------------------------------------------------
// The hApp bundle: is it keyed for this agent?
// ---------------------------------------------------------------------------

type Bundle = {
  manifest?: {
    roles?: { name: string; dna?: { modifiers?: { properties?: { progenitor_pubkey?: unknown } | null } } }[];
  };
};

/** The progenitor key a `.happ` carries for the app role, read from the bundle's manifest (gzip, then msgpack). */
export const bundleProgenitorKey = async (happBytes: Uint8Array): Promise<string | null> => {
  const { decode } = await import('@msgpack/msgpack');
  const bundle = decode(gunzipSync(happBytes)) as Bundle;
  const role = bundle.manifest?.roles?.find((r) => r.name === ROLE);
  if (!role) throw new Error(`the bundle has no '${ROLE}' role`);
  const key = role.dna?.modifiers?.properties?.progenitor_pubkey;
  return typeof key === 'string' ? key : null;
};

/** Refuses a bundle that is not keyed for `agentKey`: installing it would leave a steward that is not the progenitor. */
export const checkKeyedFor = async (happBytes: Uint8Array, agentKey: string): Promise<void> => {
  const key = await bundleProgenitorKey(happBytes);
  if (key === null) {
    throw new Error(
      'this hApp has no progenitor key (progenitor_pubkey is null): it is a development build. Take the .happ from the keyed release.'
    );
  }
  if (key !== agentKey) {
    throw new Error(
      `this hApp is keyed for ${key}, not for ${agentKey}. Install it under the key the release was built with, or build the release with this key.`
    );
  }
};

// ---------------------------------------------------------------------------
// The grant flow, over any function that makes a zome call.
// ---------------------------------------------------------------------------

export type Call = (zome: string, fn: string, payload: unknown) => Promise<unknown>;
export type LinkLike = { target: Uint8Array };

export type GrantReport = { agent: string; result: 'granted' | 'already' | 'no-profile' | 'refused'; detail?: string };

export type GrantDeps = {
  call: Call;
  /** The steward's own key, bytes. */
  me: Uint8Array;
  decodeKey: (base64: string) => Uint8Array;
  encodeKey: (bytes: Uint8Array) => string;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
};

/** The `User` entry the steward writes for itself. `picture` and `phone` are optional in the zome. */
export const stewardUser = (profile: Profile) => ({
  name: profile.name,
  nickname: profile.name,
  bio: 'The steward of this release: holds the progenitor key and grants administrator. Not a member.',
  picture: null,
  user_type: 'creator',
  email: profile.email,
  phone: null,
  time_zone: 'UTC',
  location: 'headless conductor'
});

export type Member = { name: string; agents: string[]; administrator: boolean };

/** Every profile the steward can see, with the agent keys behind it: where the keys for `grant` come from. */
export const listMembers = async (deps: GrantDeps): Promise<Member[]> => {
  const { call, decodeKey, encodeKey } = deps;
  const links = (await call('users_organizations', 'get_all_users', null)) as LinkLike[];
  const members: Member[] = [];
  for (const link of links) {
    const user = (await call('users_organizations', 'get_latest_user', link.target)) as { name: string };
    const keys = (await call('users_organizations', 'get_user_agents', link.target)) as Uint8Array[];
    const agents = keys.map(encodeKey);
    const administrator = (await Promise.all(agents.map((a) => isAdmin(call, decodeKey(a))))).some(Boolean);
    members.push({ name: user.name, agents, administrator });
  }
  return members;
};

const isAdmin = async (call: Call, agent: Uint8Array): Promise<boolean> =>
  (await call('administration', 'check_if_agent_is_administrator', { entity: NETWORK, agent_pubkey: agent })) === true;

/** The steward's profile and administrator seat. Throws when this conductor's agent is not the progenitor. */
export const ensureStewardProfile = async (deps: GrantDeps, profile: Profile): Promise<void> => {
  const { call, me, log } = deps;
  if ((await call('administration', 'is_progenitor', null)) !== true) {
    throw new Error(
      'this conductor\'s agent is not the progenitor: its key is not the progenitor_pubkey the installed hApp carries. Install the keyed release under the key from `keygen`.'
    );
  }
  const links = (await call('users_organizations', 'get_agent_user', me)) as LinkLike[];
  if (links.length === 0) {
    await call('users_organizations', 'create_user', stewardUser(profile));
    log(`created the steward profile "${profile.name}"`);
  } else {
    log('the steward already has a profile');
  }
  if (!(await isAdmin(call, me))) {
    throw new Error('the steward is the progenitor but holds no administrator grant after creating its profile. Check `status`.');
  }
  log('the steward is an administrator');
};

/** Waits up to `waitSeconds` for the agent's profile to reach this conductor, then grants administrator. */
export const grantAgent = async (deps: GrantDeps, agent: string, waitSeconds: number): Promise<GrantReport> => {
  const { call, decodeKey, sleep } = deps;
  const key = decodeKey(agent);

  if (await isAdmin(call, key)) return { agent, result: 'already' };

  const deadline = Date.now() + waitSeconds * 1000;
  let links = (await call('users_organizations', 'get_agent_user', key)) as LinkLike[];
  while (links.length === 0 && Date.now() < deadline) {
    await sleep(3000);
    links = (await call('users_organizations', 'get_agent_user', key)) as LinkLike[];
  }
  if (links.length === 0) {
    return {
      agent,
      result: 'no-profile',
      detail: 'no profile for this agent has reached the steward: the member must create one first, and the steward must be online and connected to the network'
    };
  }

  await call('administration', 'add_administrator', {
    entity: NETWORK,
    entity_original_action_hash: links[0].target,
    agent_pubkeys: [key]
  });
  return (await isAdmin(call, key))
    ? { agent, result: 'granted' }
    : { agent, result: 'refused', detail: 'add_administrator returned but the agent holds no administrator grant' };
};

/** The image formats a profile picture may be, by their first bytes. */
const PICTURE_SIGNATURES: { format: string; matches: (b: Uint8Array) => boolean }[] = [
  { format: 'PNG', matches: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x) },
  { format: 'JPEG', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { format: 'GIF', matches: (b) => String.fromCharCode(...b.slice(0, 4)) === 'GIF8' },
  { format: 'WebP', matches: (b) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP' }
];

/** Refuses a picture the zome would refuse, or one too large to send, before anything connects. */
export const checkPicture = (bytes: Uint8Array): string => {
  const found = PICTURE_SIGNATURES.find((s) => s.matches(bytes));
  if (!found) throw new Error('the picture is not a PNG, JPEG, GIF or WebP file');
  if (bytes.byteLength > MAX_PICTURE_KIB * 1024) {
    throw new Error(`the picture is ${Math.ceil(bytes.byteLength / 1024)} KiB; the limit is ${MAX_PICTURE_KIB} KiB`);
  }
  return found.format;
};

type RecordLike = { signed_action: { hashed: { hash: Uint8Array } } };

/**
 * Changes the steward's own profile: fields not in `changes` keep their current value, and a new
 * name sets the nickname too. Only the progenitor's conductor may run it, and only once `grant`
 * has created the profile. Returns the User written.
 */
export const updateStewardProfile = async (
  deps: GrantDeps,
  changes: Omit<ProfileChanges, 'picture'> & { picture?: Uint8Array }
): Promise<Record<string, unknown>> => {
  const { call, me, log } = deps;
  if ((await call('administration', 'is_progenitor', null)) !== true) {
    throw new Error("this conductor's agent is not the progenitor: update-profile changes the steward's own profile only.");
  }
  const links = (await call('users_organizations', 'get_agent_user', me)) as LinkLike[];
  if (links.length === 0) throw new Error('the steward has no profile yet: run `grant` first, which creates it.');
  const original = links[0].target;
  const latest = (await call('users_organizations', 'get_latest_user_record', original)) as RecordLike | null;
  if (!latest) throw new Error("the steward's profile record was not found on this conductor.");
  const current = (await call('users_organizations', 'get_latest_user', original)) as Record<string, unknown>;

  const updated: Record<string, unknown> = {
    ...current,
    ...(changes.name !== undefined ? { name: changes.name, nickname: changes.name } : {}),
    ...(changes.bio !== undefined ? { bio: changes.bio } : {}),
    ...(changes.email !== undefined ? { email: changes.email } : {}),
    ...(changes.picture !== undefined ? { picture: changes.picture } : {})
  };
  await call('users_organizations', 'update_user', {
    original_action_hash: original,
    previous_action_hash: latest.signed_action.hashed.hash,
    updated_user: updated
  });
  const done = [
    changes.name !== undefined ? `name "${changes.name}"` : '',
    changes.bio !== undefined ? 'bio' : '',
    changes.email !== undefined ? `email ${changes.email}` : '',
    changes.picture !== undefined ? `picture (${changes.picture.byteLength} bytes)` : ''
  ].filter(Boolean);
  log(`updated the steward profile: ${done.join(', ')}`);
  return updated;
};

// ---------------------------------------------------------------------------
// Conductor I/O
// ---------------------------------------------------------------------------

/**
 * The conductor refuses a websocket with no Origin header. The client's own
 * `origin` option only reaches the `ws` package; under Bun the socket is native
 * and ignores it, so the header is also set by hand. The client types its
 * options as `origin` alone and hands the object to the socket whole.
 */
const wsOptions = { origin: STEWARD_ORIGIN, headers: { Origin: STEWARD_ORIGIN } } as { origin: string };

const adminUrl = (port: number) => new URL(`ws://127.0.0.1:${port}`);

const connectAdmin = async (adminPort: number) => {
  const { AdminWebsocket } = await import('@holochain/client');
  return AdminWebsocket.connect({ url: adminUrl(adminPort), wsClientOptions: wsOptions });
};

/** An app client for the installed app, plus the call function and the steward's key. */
const connectApp = async (command: Connection) => {
  const client = await import('@holochain/client');
  const admin = await connectAdmin(command.adminPort);

  const apps = await admin.listApps({});
  const app = apps.find((a) => a.installed_app_id === command.installedAppId);
  if (!app) throw new Error(`no app "${command.installedAppId}" is installed on this conductor`);

  let appPort = command.appPort;
  if (appPort === undefined) {
    const interfaces = await admin.listAppInterfaces();
    const usable = interfaces.find(
      (i) =>
        (i.installed_app_id === undefined || i.installed_app_id === command.installedAppId) &&
        (i.allowed_origins === '*' || i.allowed_origins.split(',').includes(STEWARD_ORIGIN))
    );
    appPort =
      usable?.port ??
      (await admin.attachAppInterface({ allowed_origins: STEWARD_ORIGIN, installed_app_id: command.installedAppId })).port;
  }

  const cell = app.cell_info[ROLE]?.find((c) => 'type' in c && c.type === client.CellType.Provisioned);
  if (!cell || !('value' in cell) || !('cell_id' in cell.value)) throw new Error(`app "${command.installedAppId}" has no provisioned ${ROLE} cell`);
  await admin.authorizeSigningCredentials(cell.value.cell_id);

  const { token } = await admin.issueAppAuthenticationToken({ installed_app_id: command.installedAppId });
  const appWs = await client.AppWebsocket.connect({
    url: adminUrl(appPort),
    token,
    wsClientOptions: wsOptions
  });
  const call: Call = (zome, fn, payload) => appWs.callZome({ role_name: ROLE, zome_name: zome, fn_name: fn, payload });
  const deps: GrantDeps = {
    call,
    me: app.agent_pub_key,
    decodeKey: client.decodeHashFromBase64 as (b: string) => Uint8Array,
    encodeKey: client.encodeHashToBase64 as (b: Uint8Array) => string,
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
    log: (line) => console.log(line)
  };
  return { admin, app, appWs, deps };
};

/** Closes each websocket. The app client types its transport without `close`, the WsClient behind it has one. */
const close = async (...sockets: { client: unknown }[]) => {
  for (const { client } of sockets) {
    const closable = client as { close?: () => Promise<unknown> };
    await closable.close?.().catch(() => undefined);
  }
};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

const plan = (command: Command): string[] => {
  switch (command.kind) {
    case 'keygen':
      return [`connect to the admin websocket on 127.0.0.1:${command.adminPort}`, 'admin.generateAgentPubKey()', 'print the key in base64'];
    case 'install':
      return [
        `read ${resolve(command.happ)} and check its progenitor_pubkey is ${command.agentKey}`,
        `admin.installApp({ source: path, agent_key: ${command.agentKey}, installed_app_id: ${JSON.stringify(command.installedAppId)}, network_seed: ${JSON.stringify(command.networkSeed)} })`,
        'admin.enableApp()',
        `admin.attachAppInterface({ allowed_origins: ${JSON.stringify(STEWARD_ORIGIN)}${command.appPort ? `, port: ${command.appPort}` : ''} })`
      ];
    case 'grant':
      return [
        'users_organizations/get_agent_user(steward) -> create_user(profile) when there is none',
        'administration/check_if_agent_is_administrator(steward)',
        ...(command.agents.length === 0 ? ['no --agent given: the steward profile is all that is done'] : []),
        ...command.agents.flatMap((a) => [
          `users_organizations/get_agent_user(${a}), waiting up to ${command.waitSeconds}s`,
          `administration/add_administrator({ entity: "network", entity_original_action_hash: <that user>, agent_pubkeys: [${a}] })`
        ])
      ];
    case 'update-profile':
      return [
        ...(command.changes.picture ? [`read ${resolve(command.changes.picture)} (checked above)`] : []),
        'administration/is_progenitor',
        'users_organizations/get_agent_user(steward) -> get_latest_user_record, get_latest_user',
        `users_organizations/update_user, changing ${Object.keys(command.changes).join(', ')}`
      ];
    case 'status':
      return ['admin.listApps()', 'administration/is_progenitor', 'users_organizations/get_agent_user(steward)', 'administration/get_all_administrators_links("network")'];
    case 'help':
      return [];
  }
};

const keygen = async (command: Extract<Command, { kind: 'keygen' }>) => {
  const { encodeHashToBase64 } = await import('@holochain/client');
  const admin = await connectAdmin(command.adminPort);
  try {
    console.log(encodeHashToBase64(await admin.generateAgentPubKey()));
  } finally {
    await close(admin);
  }
};

const install = async (command: Extract<Command, { kind: 'install' }>) => {
  const client = await import('@holochain/client');
  const happ = resolve(command.happ);
  await checkKeyedFor(readFileSync(happ), command.agentKey);

  const admin = await connectAdmin(command.adminPort);
  try {
    // A global `network_seed` replaces the seed of every role and leaves each
    // role's `properties` alone, so the keyed progenitor_pubkey survives: it is
    // the same override the desktop wrapper uses. See documentation/progenitor.md.
    const info = await admin.installApp({
      source: { type: 'path', value: happ },
      agent_key: client.decodeHashFromBase64(command.agentKey),
      installed_app_id: command.installedAppId,
      network_seed: command.networkSeed
    });
    await admin.enableApp({ installed_app_id: command.installedAppId });
    const attached = await admin.attachAppInterface({
      allowed_origins: STEWARD_ORIGIN,
      installed_app_id: command.installedAppId,
      ...(command.appPort ? { port: command.appPort } : {})
    });
    console.log(`installed "${info.installed_app_id}" for ${command.agentKey}, enabled, app interface on port ${attached.port}`);
    for (const [role, cells] of Object.entries(info.cell_info)) {
      for (const cell of cells) {
        if ('value' in cell && 'cell_id' in cell.value) {
          console.log(`  ${role}: dna ${client.encodeHashToBase64(cell.value.cell_id[0])}`);
        }
      }
    }
    console.log('Compare these DNA hashes with desktop.installedDnaHashes in release-manifest.json: they must be equal.');
  } finally {
    await close(admin);
  }
};

const grant = async (command: Extract<Command, { kind: 'grant' }>) => {
  const { admin, appWs, deps } = await connectApp(command);
  try {
    await ensureStewardProfile(deps, command.profile);
    const reports: GrantReport[] = [];
    for (const agent of command.agents) {
      const report = await grantAgent(deps, agent, command.waitSeconds);
      reports.push(report);
      console.log(`${report.result.padEnd(10)} ${agent}${report.detail ? `  (${report.detail})` : ''}`);
    }
    if (reports.some((r) => r.result === 'no-profile' || r.result === 'refused')) process.exitCode = 1;
  } finally {
    await close(appWs, admin);
  }
};

const status = async (command: Extract<Command, { kind: 'status' }>) => {
  const { admin, app, appWs, deps } = await connectApp(command);
  try {
    const { call, me, encodeKey } = deps;
    console.log(`app        ${app.installed_app_id} (${JSON.stringify(app.status)})`);
    console.log(`steward    ${encodeKey(me)}`);
    console.log(`progenitor ${(await call('administration', 'is_progenitor', null)) === true ? 'yes' : 'NO: this agent is not the progenitor'}`);
    const links = (await call('users_organizations', 'get_agent_user', me)) as LinkLike[];
    console.log(`profile    ${links.length > 0 ? 'created' : 'none yet'}`);
    console.log(`admin      ${(await isAdmin(call, me)) ? 'yes' : 'no'}`);
    const roster = (await call('administration', 'get_all_administrators_links', NETWORK)) as LinkLike[];
    console.log(`roster     ${roster.length} administrator entr${roster.length === 1 ? 'y' : 'ies'}`);
    // The zome refuses the member list to an agent with no profile or no standing yet.
    try {
      const members = await listMembers(deps);
      console.log(`members    ${members.length}`);
      for (const m of members) console.log(`  ${m.administrator ? 'admin  ' : 'member '} ${m.name}  ${m.agents.join(' ')}`);
    } catch (error) {
      console.log(`members    not readable yet (${(error as Error).message.split('\n')[0].slice(0, 120)})`);
    }
    for (const agent of command.agents) {
      const holds = await isAdmin(call, deps.decodeKey(agent));
      console.log(`${holds ? 'admin     ' : 'not admin '} ${agent}`);
    }
  } finally {
    await close(appWs, admin);
  }
};

const updateProfile = async (command: Extract<Command, { kind: 'update-profile' }>) => {
  const { picture: path, ...rest } = command.changes;
  let picture: Uint8Array | undefined;
  if (path !== undefined) {
    picture = new Uint8Array(readFileSync(resolve(path)));
    checkPicture(picture);
  }
  const { admin, appWs, deps } = await connectApp(command);
  try {
    await updateStewardProfile(deps, { ...rest, ...(picture ? { picture } : {}) });
  } finally {
    await close(appWs, admin);
  }
};

export const run = async (argv: string[], env: Record<string, string | undefined>): Promise<number> => {
  const parsed = parseCommand(argv, env);
  if (!parsed.ok) {
    console.error(parsed.message);
    console.error(USAGE);
    return 2;
  }
  const command = parsed.command;
  if (command.kind === 'help') {
    console.log(USAGE);
    return 0;
  }
  if (command.dryRun) {
    if (command.kind === 'update-profile' && command.changes.picture !== undefined) {
      try {
        const format = checkPicture(new Uint8Array(readFileSync(resolve(command.changes.picture))));
        console.log(`picture: ${format}, accepted`);
      } catch (error) {
        console.error((error as Error).message);
        return 1;
      }
    }
    console.log(`dry run: ${command.kind}`);
    for (const step of plan(command)) console.log(`  ${step}`);
    return 0;
  }
  try {
    if (command.kind === 'keygen') await keygen(command);
    else if (command.kind === 'install') await install(command);
    else if (command.kind === 'grant') await grant(command);
    else if (command.kind === 'update-profile') await updateProfile(command);
    else await status(command);
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
  return Number(process.exitCode ?? 0);
};

if (import.meta.main) {
  process.exit(await run(Bun.argv.slice(2), process.env));
}
