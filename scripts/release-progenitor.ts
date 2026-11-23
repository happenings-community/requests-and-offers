/**
 * release-progenitor.ts: key a release build with its progenitor.
 *
 * `workdir/happ.yaml` carries `progenitor_pubkey: ~` for local development: with
 * no key, the first member to create a profile on a fresh network becomes its
 * administrator. A desktop install generates its own agent key at install time,
 * so no desktop install can be the progenitor, and a release built with `~`
 * lets a joining member take the network (#600).
 *
 * A release is therefore keyed with the key of a headless steward conductor
 * (scripts/progenitor-steward.ts, documentation/progenitor.md). This script
 * writes that key into the `requests_and_offers` role's properties before the
 * hApp is packed, and refuses to go on when the key is missing or malformed.
 * The file in the repository keeps `~`: only the release build edits it.
 *
 * Only that one line changes, by text replacement, so comments and layout stay.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

/** The role whose properties carry the key. */
export const ROLE = 'requests_and_offers';

/** A Holochain AgentPubKey in base64: `uhCAk` and 48 more URL-safe characters, 53 in all. */
const AGENT_PUBKEY = /^uhCAk[A-Za-z0-9_-]{48}$/;

export const isAgentPubKey = (key: string): boolean => AGENT_PUBKEY.test(key);

const LINE = /^(\s*progenitor_pubkey:[ \t]*)(\S*)([ \t]*(?:#.*)?)$/gm;

export type ProgenitorVerdict = { ok: true; yaml: string } | { ok: false; reason: string };

type HappManifest = {
  roles?: {
    name: string;
    dna?: { modifiers?: { properties?: { progenitor_pubkey?: unknown } | null } };
  }[];
};

/** The key the manifest carries for the role: a string, or null for development mode. */
export const readProgenitorKey = (happYaml: string): string | null => {
  const manifest = Bun.YAML.parse(happYaml) as HappManifest;
  const role = manifest.roles?.find((r) => r.name === ROLE);
  if (!role) throw new Error(`role '${ROLE}' not found in the hApp manifest`);
  const key = role.dna?.modifiers?.properties?.progenitor_pubkey;
  return typeof key === 'string' ? key : null;
};

const malformed = (key: string): string =>
  `the progenitor key is not a Holochain AgentPubKey: it must start with 'uhCAk' and be 53 characters, this one is ${key.length} long and starts ${JSON.stringify(key.slice(0, 5))}.`;

/** Write `key` into the manifest text. Refuses unless the line is found exactly once. */
export const setProgenitorKey = (happYaml: string, key: string): ProgenitorVerdict => {
  if (!isAgentPubKey(key)) return { ok: false, reason: malformed(key) };

  const found = [...happYaml.matchAll(LINE)];
  if (found.length !== 1) {
    return {
      ok: false,
      reason: `expected exactly one 'progenitor_pubkey:' line in the hApp manifest, found ${found.length}. Edit the manifest by hand.`
    };
  }
  const yaml = happYaml.replace(
    LINE,
    (_all, head: string, _old: string, tail: string) => `${head}${key}${tail}`
  );

  // The line was the right one only if the role now reads back the key.
  let written: string | null;
  try {
    written = readProgenitorKey(yaml);
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
  if (written !== key) {
    return {
      ok: false,
      reason: `the 'progenitor_pubkey:' line is not the ${ROLE} role's property, so the key did not land where the DNA reads it. Edit the manifest by hand.`
    };
  }
  return { ok: true, yaml };
};

export type Outcome = { code: number; stdout: string[]; stderr: string[] };

export type Options = {
  argv: string[];
  env: Record<string, string | undefined>;
  read?: (path: string) => string;
  write?: (path: string, text: string) => void;
};

const USAGE = `usage: bun scripts/release-progenitor.ts [--key <AgentPubKey>] [--happ workdir/happ.yaml] [--allow-dev-mode]

Writes the progenitor key into the ${ROLE} role of the hApp manifest.
The key comes from --key or the PROGENITOR_PUBKEY environment variable.
Exits 1 when there is none or it is malformed.
--allow-dev-mode, only when no key is given, leaves '~' and warns instead of failing.`;

export const keyRelease = (options: Options): Outcome => {
  const read = options.read ?? ((path: string) => readFileSync(path, 'utf8'));
  const write = options.write ?? ((path: string, text: string) => writeFileSync(path, text));

  let values: { key?: string; happ?: string; 'allow-dev-mode'?: boolean; help?: boolean };
  try {
    values = parseArgs({
      args: options.argv,
      options: {
        key: { type: 'string' },
        happ: { type: 'string' },
        'allow-dev-mode': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' }
      },
      strict: true
    }).values;
  } catch (error) {
    return { code: 2, stdout: [], stderr: [(error as Error).message, USAGE] };
  }
  if (values.help) return { code: 0, stdout: [USAGE], stderr: [] };

  const happ = values.happ ?? 'workdir/happ.yaml';
  // An empty repository variable reaches the environment as an empty string: no key.
  const key = (values.key ?? options.env.PROGENITOR_PUBKEY ?? '').trim();

  if (key === '') {
    if (values['allow-dev-mode']) {
      return {
        code: 0,
        stdout: [],
        stderr: [
          'WARNING: no progenitor key. This build runs in development mode: the first member to create a profile on a fresh network becomes its administrator (#600).',
          'WARNING: never publish this build. It is for a dry run of the release chain only.'
        ]
      };
    }
    return {
      code: 1,
      stdout: [],
      stderr: [
        'No progenitor key. Set the repository variable PROGENITOR_PUBKEY to the steward key (documentation/progenitor.md), or pass --key.',
        'A release without a key lets a joining member become network administrator (#600).'
      ]
    };
  }

  const verdict = setProgenitorKey(read(happ), key);
  if (!verdict.ok) return { code: 1, stdout: [], stderr: [verdict.reason] };

  write(happ, verdict.yaml);
  return { code: 0, stdout: [`${happ}: ${ROLE} progenitor_pubkey set to ${key}.`], stderr: [] };
};

if (import.meta.main) {
  const outcome = keyRelease({ argv: Bun.argv.slice(2), env: process.env });
  for (const line of outcome.stdout) console.log(line);
  for (const line of outcome.stderr) console.error(line);
  process.exit(outcome.code);
}
