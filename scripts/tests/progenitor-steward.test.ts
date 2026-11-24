import { describe, expect, it } from 'bun:test';
import { encode } from '@msgpack/msgpack';
import { dhtLocationFrom32, encodeHashToBase64 } from '@holochain/client';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  type Call,
  type GrantDeps,
  type LinkLike,
  bundleProgenitorKey,
  checkKeyedFor,
  checkPicture,
  ensureStewardProfile,
  grantAgent,
  listMembers,
  parseCommand,
  stewardUser,
  updateStewardProfile
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

  it('reads update-profile with only the fields given, and refuses it with none', () => {
    expect(parseCommand(['update-profile', '--name', 'Network keyholder', '--picture', 'k.png'])).toEqual({
      ok: true,
      command: {
        kind: 'update-profile',
        dryRun: false,
        adminPort: 4444,
        installedAppId: 'requests_and_offers',
        appPort: undefined,
        changes: { name: 'Network keyholder', picture: 'k.png' }
      }
    });
    expect(parseCommand(['update-profile', '--bio', ''])).toMatchObject({ ok: true, command: { changes: { bio: '' } } });
    expect(parseCommand(['update-profile'])).toEqual({
      ok: false,
      message: 'update-profile needs at least one of --name, --bio, --email, --picture'
    });
    expect(parseCommand(['update-profile', '--name', '  '])).toEqual({ ok: false, message: '--name must not be empty' });
    expect(parseCommand(['update-profile', '--name', ' Keyholder '])).toMatchObject({ command: { changes: { name: 'Keyholder' } } });
    expect(parseCommand(['update-profile', '--email', 'nobody'])).toEqual({ ok: false, message: '--email "nobody" is not an email address' });
  });

  it('refuses a flag that belongs to another command, rather than ignoring it', () => {
    expect(parseCommand(['grant', '--picture', 'k.png'])).toEqual({ ok: false, message: '--picture does not apply to grant' });
    expect(parseCommand(['grant', '--bio', 'x'])).toEqual({ ok: false, message: '--bio does not apply to grant' });
    expect(parseCommand(['update-profile', '--name', 'K', '--agent', ALICE])).toEqual({ ok: false, message: '--agent does not apply to update-profile' });
    expect(parseCommand(['status', '--name', 'K'])).toEqual({ ok: false, message: '--name does not apply to status' });
    expect(parseCommand(['keygen', '--happ', 'r.happ'])).toEqual({ ok: false, message: '--happ does not apply to keygen' });
    expect(parseCommand(['install', '--happ', 'r.happ', '--agent-key', STEWARD, '--network-seed', 's', '--app-id', 'x']).ok).toBe(true);
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
  let latestUser: Record<string, unknown> = stewardUser({ name: 'Steward', email: 'steward@example.org' });
  let latestHash = userHash(STEWARD);
  let revisions = 0;

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
      case 'users_organizations/get_latest_user_record':
      case 'users_organizations/get_latest_user': {
        // Asked by the steward's original profile hash, as the zome expects; anything else finds nothing.
        if (key(payload as Uint8Array) !== key(userHash(STEWARD))) throw new Error(`${fn} asked for ${key(payload as Uint8Array)}`);
        return fn === 'get_latest_user' ? { ...latestUser } : { signed_action: { hashed: { hash: latestHash } } };
      }
      case 'users_organizations/update_user':
        latestUser = (payload as { updated_user: Record<string, unknown> }).updated_user;
        latestHash = new TextEncoder().encode(`revision-${++revisions}`);
        return {};
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

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

describe('updating the steward profile', () => {
  it('accepts the image formats the zome decodes, and refuses anything else or too large', () => {
    expect(checkPicture(PNG)).toBe('PNG');
    expect(checkPicture(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('JPEG');
    expect(checkPicture(new TextEncoder().encode('GIF89a'))).toBe('GIF');
    expect(checkPicture(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('WebP');
    expect(() => checkPicture(new TextEncoder().encode('not an image'))).toThrow(/not a PNG/);
    const big = new Uint8Array(600 * 1024);
    big.set(PNG);
    expect(() => checkPicture(big)).toThrow(/600 KiB; the limit is 512 KiB/);
  });

  it('changes only the fields given, sets the nickname with the name, and updates from the latest revision', async () => {
    const w = world({ profiles: [STEWARD], admins: [STEWARD] });
    const first = await updateStewardProfile(w.deps, { name: 'Network keyholder', picture: PNG });
    // Every field the change leaves alone is written back as it was: user_type, time_zone,
    // location and phone included, or the zome refuses the update or the data is lost.
    expect(first).toEqual({
      ...stewardUser({ name: 'Steward', email: 'steward@example.org' }),
      name: 'Network keyholder',
      nickname: 'Network keyholder',
      picture: PNG
    });
    const update = w.calls.find((c) => c.fn === 'update_user')?.payload as Record<string, Uint8Array>;
    expect(new TextDecoder().decode(update.original_action_hash)).toBe(`user-of-${STEWARD}`);
    expect(new TextDecoder().decode(update.previous_action_hash)).toBe(`user-of-${STEWARD}`);

    const second = await updateStewardProfile(w.deps, { bio: 'Automated. Not a member.' });
    expect(second).toMatchObject({ name: 'Network keyholder', picture: PNG, bio: 'Automated. Not a member.' });
    const updates = w.calls.filter((c) => c.fn === 'update_user').map((c) => c.payload as Record<string, Uint8Array>);
    expect(new TextDecoder().decode(updates[1].original_action_hash)).toBe(`user-of-${STEWARD}`);
    expect(new TextDecoder().decode(updates[1].previous_action_hash)).toBe('revision-1');
  });

  it('refuses before it writes anything when the agent is not the progenitor, or has no profile yet', async () => {
    const notProgenitor = world({ progenitor: false, profiles: [STEWARD] });
    await expect(updateStewardProfile(notProgenitor.deps, { name: 'X' })).rejects.toThrow(/not the progenitor/);
    expect(notProgenitor.calls.some((c) => c.fn === 'update_user')).toBe(false);

    const noProfile = world();
    await expect(updateStewardProfile(noProfile.deps, { name: 'X' })).rejects.toThrow(/run `grant` first/);
    expect(noProfile.calls.some((c) => c.fn === 'update_user')).toBe(false);
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

  it('parses an update-profile as a dry run and names what it would change', () => {
    const result = spawn(['update-profile', '--name', 'Network keyholder', '--bio', 'Automated.', '--dry-run']);
    expect(result.exitCode).toBe(0);
    const out = result.stdout.toString();
    expect(out).toContain('dry run: update-profile');
    expect(out).toContain('users_organizations/update_user, changing name, bio');
  });

  it('checks the picture in a dry run too, so a bad file shows before the real run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'steward-picture-'));
    const good = join(dir, 'k.png');
    const bad = join(dir, 'k.txt');
    writeFileSync(good, PNG);
    writeFileSync(bad, 'not an image');
    const ok = spawn(['update-profile', '--picture', good, '--dry-run']);
    expect(ok.exitCode).toBe(0);
    expect(ok.stdout.toString()).toContain('picture: PNG, accepted');
    const refused = spawn(['update-profile', '--picture', bad, '--dry-run']);
    expect(refused.exitCode).toBe(1);
    expect(refused.stderr.toString()).toContain('not a PNG');
    expect(spawn(['update-profile', '--picture', join(dir, 'missing.png'), '--dry-run']).exitCode).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('exits 2 on arguments it cannot parse', () => {
    expect(spawn(['grant', '--agent', 'nope']).exitCode).toBe(2);
    expect(spawn(['install', '--dry-run']).exitCode).toBe(2);
  });
});
