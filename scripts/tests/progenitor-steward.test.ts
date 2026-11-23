import { describe, expect, it } from 'bun:test';
import { encode } from '@msgpack/msgpack';
import { dhtLocationFrom32, encodeHashToBase64 } from '@holochain/client';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  type Call,
  type GrantDeps,
  type LinkLike,
  bundleProgenitorKey,
  checkKeyedFor,
  ensureStewardProfile,
  grantAgent,
  listMembers,
  parseCommand,
  stewardUser
} from '../progenitor-steward.ts';

const script = join(import.meta.dir, '..', 'progenitor-steward.ts');

// Real AgentPubKeys, with the location checksum the zome and the scripts check: a core of one
// repeated byte, so each test agent is told apart by the letter it was made from.
const keyOf = (fill: string) => {
  const core = new Uint8Array(32).fill(fill.charCodeAt(0));
  return encodeHashToBase64(Uint8Array.from([0x84, 0x20, 0x24, ...core, ...dhtLocationFrom32(core)]));
};
const STEWARD = keyOf('S');
const ALICE = keyOf('A');
const BOB = keyOf('B');

describe('parseCommand', () => {
  it('prints help with no command, with help, and with --help', () => {
    for (const argv of [[], ['help'], ['--help'], ['grant', '--help']]) {
      expect(parseCommand(argv)).toEqual({ ok: true, command: { kind: 'help' } });
    }
  });

  it('refuses an unknown command', () => {
    expect(parseCommand(['frobnicate'])).toEqual({ ok: false, message: 'unknown command "frobnicate"' });
  });

  it('reads keygen with the admin port, default 4444, or from the environment', () => {
    expect(parseCommand(['keygen'])).toEqual({ ok: true, command: { kind: 'keygen', dryRun: false, adminPort: 4444 } });
    expect(parseCommand(['keygen', '--admin-port', '5000'])).toMatchObject({ ok: true, command: { adminPort: 5000 } });
    expect(parseCommand(['keygen'], { HC_ADMIN_PORT: '4321' })).toMatchObject({ ok: true, command: { adminPort: 4321 } });
  });

  it('refuses a port that is not one', () => {
    expect(parseCommand(['keygen', '--admin-port', 'abc']).ok).toBe(false);
    expect(parseCommand(['keygen', '--admin-port', '70000']).ok).toBe(false);
  });

  it('reads install and demands its three inputs', () => {
    const argv = ['install', '--happ', 'r.happ', '--agent-key', STEWARD, '--network-seed', 'alpha2'];
    expect(parseCommand(argv)).toEqual({
      ok: true,
      command: {
        kind: 'install',
        dryRun: false,
        adminPort: 4444,
        installedAppId: 'requests_and_offers',
        appPort: undefined,
        happ: 'r.happ',
        agentKey: STEWARD,
        networkSeed: 'alpha2'
      }
    });
    expect(parseCommand(['install', '--agent-key', STEWARD, '--network-seed', 's']).ok).toBe(false);
    expect(parseCommand(['install', '--happ', 'r.happ', '--network-seed', 's']).ok).toBe(false);
    expect(parseCommand(['install', '--happ', 'r.happ', '--agent-key', 'nope', '--network-seed', 's']).ok).toBe(false);
    expect(parseCommand(['install', '--happ', 'r.happ', '--agent-key', STEWARD]).ok).toBe(false);
  });

  it('reads grant with repeated agents, once each, and the steward profile defaults', () => {
    const parsed = parseCommand(['grant', '--agent', ALICE, '--agent', BOB, '--agent', ALICE]);
    expect(parsed).toMatchObject({
      ok: true,
      command: {
        kind: 'grant',
        agents: [ALICE, BOB],
        profile: { name: 'Steward', email: 'steward@example.org' },
        waitSeconds: 60
      }
    });
  });

  it('reads grant with no agent as the steward profile alone, and refuses a malformed agent', () => {
    expect(parseCommand(['grant'])).toMatchObject({ ok: true, command: { kind: 'grant', agents: [] } });
    expect(parseCommand(['grant', '--agent', 'uhCAkShort']).ok).toBe(false);
  });

  it('reads status, with or without agents', () => {
    expect(parseCommand(['status'])).toMatchObject({ ok: true, command: { kind: 'status', agents: [] } });
    expect(parseCommand(['status', '--agent', ALICE])).toMatchObject({ ok: true, command: { agents: [ALICE] } });
  });

  it('refuses an unknown flag', () => {
    expect(parseCommand(['status', '--bogus']).ok).toBe(false);
  });
});

const bundle = (progenitor: unknown) =>
  gzipSync(
    encode({
      manifest: {
        roles: [
          { name: 'requests_and_offers', dna: { modifiers: { properties: { progenitor_pubkey: progenitor } } } },
          { name: 'hrea', dna: { modifiers: { properties: null } } }
        ]
      },
      resources: {}
    })
  );

describe('the hApp bundle key check', () => {
  it('reads the key the bundle carries', async () => {
    expect(await bundleProgenitorKey(bundle(STEWARD))).toBe(STEWARD);
    expect(await bundleProgenitorKey(bundle(null))).toBeNull();
  });

  it('accepts a bundle keyed for the agent', async () => {
    await checkKeyedFor(bundle(STEWARD), STEWARD);
  });

  it('refuses a development build', async () => {
    await expect(checkKeyedFor(bundle(null), STEWARD)).rejects.toThrow(/development build/);
  });

  it('refuses a bundle keyed for someone else', async () => {
    await expect(checkKeyedFor(bundle(ALICE), STEWARD)).rejects.toThrow(`keyed for ${ALICE}`);
  });
});

// A fake conductor: the zome functions the steward calls, over in-memory state.
const world = (options: { progenitor?: boolean; profiles?: string[]; admins?: string[] } = {}) => {
  const key = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
  const admins = new Set(options.admins ?? []);
  const profiles = new Set(options.profiles ?? []);
  const calls: { zome: string; fn: string; payload: unknown }[] = [];
  const userHash = (agent: string) => new TextEncoder().encode(`user-of-${agent}`);

  const call: Call = async (zome, fn, payload) => {
    calls.push({ zome, fn, payload });
    switch (`${zome}/${fn}`) {
      case 'administration/is_progenitor':
        return options.progenitor ?? true;
      case 'users_organizations/get_agent_user':
        return profiles.has(key(payload as Uint8Array)) ? [{ target: userHash(key(payload as Uint8Array)) }] : [];
      case 'users_organizations/create_user':
        profiles.add(STEWARD);
        admins.add(STEWARD);
        return {};
      case 'administration/check_if_agent_is_administrator':
        return admins.has(key((payload as { agent_pubkey: Uint8Array }).agent_pubkey));
      case 'administration/add_administrator':
        for (const k of (payload as { agent_pubkeys: Uint8Array[] }).agent_pubkeys) admins.add(key(k));
        return true;
      default:
        throw new Error(`unexpected call ${zome}/${fn}`);
    }
  };
  const deps: GrantDeps = {
    call,
    me: new TextEncoder().encode(STEWARD),
    decodeKey: (b64) => new TextEncoder().encode(b64),
    encodeKey: key,
    sleep: async () => undefined,
    log: () => undefined
  };
  return { deps, calls, admins, profiles, userHash };
};

describe('the steward profile', () => {
  it('creates the profile once, as the progenitor, and checks the seat', async () => {
    const w = world();
    await ensureStewardProfile(w.deps, { name: 'Steward', email: 'steward@example.org' });
    expect(w.calls.filter((c) => c.fn === 'create_user')).toHaveLength(1);
    expect(w.calls.find((c) => c.fn === 'create_user')?.payload).toEqual(
      stewardUser({ name: 'Steward', email: 'steward@example.org' })
    );
    await ensureStewardProfile(w.deps, { name: 'Steward', email: 'steward@example.org' });
    expect(w.calls.filter((c) => c.fn === 'create_user')).toHaveLength(1);
  });

  it('writes a User the zome accepts: a valid type and email, optional fields null', () => {
    const user = stewardUser({ name: 'Steward', email: 'steward@example.org' });
    expect(user.user_type).toBe('creator');
    expect(user.email).toContain('@');
    expect(user.picture).toBeNull();
    expect(user.phone).toBeNull();
    expect(Object.keys(user).sort()).toEqual(
      ['bio', 'email', 'location', 'name', 'nickname', 'phone', 'picture', 'time_zone', 'user_type']
    );
  });

  it('refuses to go on when the agent is not the progenitor, before it writes anything', async () => {
    const w = world({ progenitor: false });
    await expect(ensureStewardProfile(w.deps, { name: 'S', email: 'a@b.co' })).rejects.toThrow(/not the progenitor/);
    expect(w.calls.some((c) => c.fn === 'create_user')).toBe(false);
  });
});

describe('listing the members', () => {
  it('names each profile with its agent keys and whether it holds administrator', async () => {
    const w = world({ profiles: [ALICE], admins: [STEWARD] });
    const enc = (s: string) => new TextEncoder().encode(s);
    const call: Call = async (zome, fn, payload) => {
      if (fn === 'get_all_users') return [{ target: enc('u-alice') }, { target: enc('u-steward') }];
      if (fn === 'get_latest_user') return { name: new TextDecoder().decode(payload as Uint8Array) === 'u-alice' ? 'Alice' : 'Steward' };
      if (fn === 'get_user_agents') return [enc(new TextDecoder().decode(payload as Uint8Array) === 'u-alice' ? ALICE : STEWARD)];
      return w.deps.call(zome, fn, payload);
    };
    expect(await listMembers({ ...w.deps, call })).toEqual([
      { name: 'Alice', agents: [ALICE], administrator: false },
      { name: 'Steward', agents: [STEWARD], administrator: true }
    ]);
  });
});

describe('granting administrator', () => {
  it('sends add_administrator with the network entity, the member user and the agent key', async () => {
    const w = world({ profiles: [ALICE], admins: [STEWARD] });
    const report = await grantAgent(w.deps, ALICE, 0);
    expect(report).toEqual({ agent: ALICE, result: 'granted' });
    const sent = w.calls.find((c) => c.fn === 'add_administrator');
    expect(sent?.zome).toBe('administration');
    expect(sent?.payload).toEqual({
      entity: 'network',
      entity_original_action_hash: w.userHash(ALICE),
      agent_pubkeys: [new TextEncoder().encode(ALICE)]
    });
  });

  it('does nothing for an agent that is already an administrator', async () => {
    const w = world({ profiles: [ALICE], admins: [STEWARD, ALICE] });
    expect(await grantAgent(w.deps, ALICE, 0)).toEqual({ agent: ALICE, result: 'already' });
    expect(w.calls.some((c) => c.fn === 'add_administrator')).toBe(false);
  });

  it('reports an agent whose profile has not arrived, and writes nothing for it', async () => {
    const w = world({ admins: [STEWARD] });
    const report = await grantAgent(w.deps, BOB, 0);
    expect(report.result).toBe('no-profile');
    expect(w.calls.some((c) => c.fn === 'add_administrator')).toBe(false);
  });

  it('waits for the profile to arrive', async () => {
    const w = world({ admins: [STEWARD] });
    let polls = 0;
    const call: Call = async (zome, fn, payload) => {
      if (fn === 'get_agent_user' && ++polls === 3) w.profiles.add(BOB);
      return w.deps.call(zome, fn, payload);
    };
    const report = await grantAgent({ ...w.deps, call, sleep: async () => undefined }, BOB, 60);
    expect(report.result).toBe('granted');
  });

  it('reports a grant the conductor accepted but did not take', async () => {
    const w = world({ profiles: [ALICE], admins: [STEWARD] });
    const call: Call = async (zome, fn, payload) =>
      fn === 'add_administrator' ? true : w.deps.call(zome, fn, payload);
    expect((await grantAgent({ ...w.deps, call }, ALICE, 0)).result).toBe('refused');
  });
});

describe('the command line', () => {
  const spawn = (args: string[]) => Bun.spawnSync(['bun', script, ...args], { env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' } });

  it('prints its help and exits 0, without a conductor', () => {
    const result = spawn(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('keygen');
    expect(result.stdout.toString()).toContain('grant [--agent');
  });

  it('parses a grant as a dry run and names the calls it would make', () => {
    const result = spawn(['grant', '--agent', ALICE, '--dry-run']);
    expect(result.exitCode).toBe(0);
    const out = result.stdout.toString();
    expect(out).toContain('dry run: grant');
    expect(out).toContain('administration/add_administrator');
    expect(out).toContain(ALICE);
  });

  it('exits 2 on arguments it cannot parse', () => {
    expect(spawn(['grant', '--agent', 'nope']).exitCode).toBe(2);
    expect(spawn(['install', '--dry-run']).exitCode).toBe(2);
  });
});
