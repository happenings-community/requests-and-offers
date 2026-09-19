#!/usr/bin/env bun
/**
 * release-manifest.ts — emit the release manifest for a tagged build.
 *
 * WHY THIS EXISTS
 *
 * The same three values are retyped in four places today: the version, the
 * network seed, and the DNA hash. They live in `package.json`, in the wrapper's
 * `kangaroo.config.ts`, in `edge-node/happ-config.json`, and in the release
 * notes. An edge node left on the previous network seed keeps gossiping on a
 * network nobody else is on, reports itself healthy, and nothing notices.
 *
 * This script measures those values from the build instead of accepting them,
 * and publishes them as a release asset so every consumer reads one source.
 *
 * WHAT IT DELIBERATELY DOES NOT CLAIM
 *
 * `dna.hash` is the hash of the DNA file, taken before the role's modifiers are
 * applied. The hash of an INSTALLED cell also depends on the effective network
 * seed, which the desktop wrapper overrides at install time, so it cannot be
 * computed here without installing. `edge-node/health-check.sh` therefore
 * compares version, seed and happ digest, and reports the installed cell hash
 * rather than asserting it.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

export type ManifestInputs = {
  /** Repository root, so the script is callable from anywhere. */
  root: string;
  /** Tag being released, e.g. `v0.6.0-alpha.2`. */
  tag: string;
  happPath: string;
  webhappPath: string;
  dnaPath: string;
  /** Injected so the unit tests need neither Nix nor the artefacts. */
  run?: (command: string, args: string[]) => string;
  readBytes?: (path: string) => Uint8Array;
  now?: () => Date;
};

export type ReleaseManifest = {
  version: string;
  tag: string;
  generatedAt: string;
  holochainVersion: string;
  happ: { file: string; sha256: string };
  webhapp: { file: string; sha256: string };
  dna: { file: string; hash: string; appliesModifiers: false };
  network: { requestsAndOffersSeed: string; hreaSeed: string };
};

const defaultRun = (command: string, args: string[]): string => {
  const result = Bun.spawnSync([command, ...args]);
  if (result.exitCode !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} exited ${result.exitCode}: ${result.stderr.toString().trim()}`
    );
  }
  return result.stdout.toString().trim();
};

const defaultReadBytes = (path: string): Uint8Array => readFileSync(path);

/** `holochain_cli 0.6.1` -> `0.6.1`. Anything else is a version we cannot vouch for. */
export const parseHolochainVersion = (raw: string): string => {
  const match = raw.trim().match(/^holochain_cli\s+(\S+)$/);
  if (!match) throw new Error(`unrecognised 'hc --version' output: ${JSON.stringify(raw)}`);
  return match[1];
};

/** Read one role's network seed out of the hApp manifest, by role name. */
export const seedForRole = (happYaml: string, role: string): string => {
  const manifest = Bun.YAML.parse(happYaml) as {
    roles?: { name: string; dna?: { modifiers?: { network_seed?: string } } }[];
  };
  const found = manifest.roles?.find((r) => r.name === role);
  if (!found) throw new Error(`role '${role}' not found in workdir/happ.yaml`);
  const seed = found.dna?.modifiers?.network_seed;
  // A null seed is a real configuration, but it is never what a release wants:
  // it would mean every deployment lands on the same unnamespaced network.
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new Error(`role '${role}' has no network_seed in workdir/happ.yaml`);
  }
  return seed;
};

/** The tag is the authority on the version; package.json must agree with it. */
export const versionFromTag = (tag: string, packageVersion: string): string => {
  const version = tag.startsWith('v') ? tag.slice(1) : tag;
  if (version !== packageVersion) {
    throw new Error(
      `tag ${tag} says version ${version} but package.json says ${packageVersion}. ` +
        `Bump package.json and ui/package.json before tagging.`
    );
  }
  return version;
};

export const buildManifest = (input: ManifestInputs): ReleaseManifest => {
  const run = input.run ?? defaultRun;
  const readBytes = input.readBytes ?? defaultReadBytes;
  const now = input.now ?? (() => new Date());

  const sha256 = (path: string) => createHash('sha256').update(readBytes(path)).digest('hex');

  const packageVersion = (
    JSON.parse(readFileSync(`${input.root}/package.json`, 'utf8')) as { version: string }
  ).version;
  const happYaml = readFileSync(`${input.root}/workdir/happ.yaml`, 'utf8');

  return {
    version: versionFromTag(input.tag, packageVersion),
    tag: input.tag,
    generatedAt: now().toISOString(),
    holochainVersion: parseHolochainVersion(run('hc', ['--version'])),
    happ: { file: basename(input.happPath), sha256: sha256(input.happPath) },
    webhapp: { file: basename(input.webhappPath), sha256: sha256(input.webhappPath) },
    dna: {
      file: basename(input.dnaPath),
      hash: run('hc', ['dna', 'hash', input.dnaPath]),
      appliesModifiers: false,
    },
    network: {
      requestsAndOffersSeed: seedForRole(happYaml, 'requests_and_offers'),
      hreaSeed: seedForRole(happYaml, 'hrea'),
    },
  };
};

const flag = (argv: string[], name: string): string => {
  const index = argv.indexOf(`--${name}`);
  if (index === -1 || !argv[index + 1]) throw new Error(`missing --${name}`);
  return argv[index + 1];
};

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  const out = flag(argv, 'out');
  const manifest = buildManifest({
    root: argv.includes('--root') ? flag(argv, 'root') : process.cwd(),
    tag: flag(argv, 'tag'),
    happPath: flag(argv, 'happ'),
    webhappPath: flag(argv, 'webhapp'),
    dnaPath: flag(argv, 'dna'),
  });
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${out}`);
  console.log(JSON.stringify(manifest, null, 2));
}
