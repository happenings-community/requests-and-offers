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
 * TWO NETWORKS, TWO SEEDS
 *
 * The hApp bundle carries a default network seed per role (`workdir/happ.yaml`),
 * and that is what an edge node runs. The desktop wrapper does not: its
 * `kangaroo.config.ts` sets `networkSeed`, which it passes to `installApp` and
 * which replaces the seed for the whole app at install time. A desktop tester is
 * therefore never on the hApp's seed. The manifest records both, under
 * `network` (the hApp's) and `desktop` (the wrapper's), and the release note
 * names the desktop one wherever it describes the desktop network.
 *
 * WHAT `dna.hash` IS AND IS NOT
 *
 * `dna.hash` is the hash of the DNA file, taken before any modifier is applied.
 * It is not the hash of an installed cell. The installed hash depends on the
 * effective network seed, and for the desktop that seed is the wrapper's. With
 * the wrapper's `kangaroo.config.ts` in hand it can be computed without a
 * conductor: unpack the DNA, set the seed (and the role's properties, which the
 * hApp manifest also overrides), repack, hash. That is `desktop.installedDnaHashes`.
 *
 * It is a PREDICTION, and it rests on one assumption: that the seed passed to
 * `installApp` replaces the seed of every role. The folder names under the
 * conductor's `databases` directory are the ground truth, and Build Acceptance
 * compares them to this field. A mismatch means the assumption is wrong for
 * that role, not that the build is broken.
 */

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

export type ManifestInputs = {
  /** Repository root, so the script is callable from anywhere. */
  root: string;
  /** Tag being released, e.g. `v0.6.0-alpha.2`. */
  tag: string;
  happPath: string;
  webhappPath: string;
  dnaPath: string;
  /** The hREA DNA bundle (`workdir/hrea.dna`), needed to predict its installed hash. */
  hreaDnaPath: string;
  /** Source text of the wrapper's `kangaroo.config.ts`, which owns the desktop seed. */
  wrapperConfig: string;
  /** Where the wrapper config came from, recorded so a reader can re-fetch it. */
  wrapperConfigSource: string;
  /** Injected so the unit tests need neither Nix nor the artefacts. */
  run?: (command: string, args: string[]) => string;
  readBytes?: (path: string) => Uint8Array;
  /** Hash of `dnaPath` once `modifiers` are applied. Default shells out to `hc`. */
  installedHash?: (dnaPath: string, modifiers: InstalledModifiers) => string;
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
  /** The seeds the hApp bundle ships with. Edge nodes run these. */
  network: { requestsAndOffersSeed: string; hreaSeed: string };
  /** What a desktop install actually runs: the wrapper's seed, not the hApp's. */
  desktop: {
    networkSeed: string;
    networkSeedSource: string;
    /** Predicted, per role. See the header: confirm against the `databases` folder names. */
    installedDnaHashes: { requests_and_offers: string; hrea: string };
  };
};

/** The modifiers an install applies on top of a DNA file. */
export type InstalledModifiers = { networkSeed: string; properties?: unknown };

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

/**
 * The wrapper's seed, out of `kangaroo.config.ts`. A regex rather than an import:
 * the file imports the wrapper's own `defineConfig`, which does not exist here.
 * It stops at the first `networkSeed:` key, which the config has exactly once.
 */
export const parseWrapperSeed = (configSource: string): string => {
  const match = configSource.match(/^\s*networkSeed:\s*(['"])([^'"\n]+)\1/m);
  if (!match) {
    throw new Error("no `networkSeed: '...'` found in the wrapper's kangaroo.config.ts");
  }
  return match[2];
};

/** One role's modifiers from the hApp manifest: the properties the install also overrides. */
export const propertiesForRole = (happYaml: string, role: string): unknown => {
  const manifest = Bun.YAML.parse(happYaml) as {
    roles?: { name: string; dna?: { modifiers?: { properties?: unknown } } }[];
  };
  const found = manifest.roles?.find((r) => r.name === role);
  if (!found) throw new Error(`role '${role}' not found in workdir/happ.yaml`);
  return found.dna?.modifiers?.properties ?? undefined;
};

/** Rewrite an unpacked `dna.yaml` the way an install would. Properties only when the role sets some. */
export const withInstalledModifiers = (dnaYaml: string, modifiers: InstalledModifiers): string => {
  const manifest = Bun.YAML.parse(dnaYaml) as { integrity: Record<string, unknown> };
  manifest.integrity.network_seed = modifiers.networkSeed;
  if (modifiers.properties !== undefined && modifiers.properties !== null) {
    manifest.integrity.properties = modifiers.properties;
  }
  return Bun.YAML.stringify(manifest, null, 2);
};

const defaultInstalledHash = (dnaPath: string, modifiers: InstalledModifiers): string => {
  const dir = mkdtempSync(join(tmpdir(), 'installed-dna-'));
  try {
    const unpacked = join(dir, 'unpacked');
    const repacked = join(dir, 'installed.dna');
    defaultRun('hc', ['dna', 'unpack', '-o', unpacked, dnaPath]);
    const manifestPath = join(unpacked, 'dna.yaml');
    writeFileSync(manifestPath, withInstalledModifiers(readFileSync(manifestPath, 'utf8'), modifiers));
    defaultRun('hc', ['dna', 'pack', '-o', repacked, unpacked]);
    return defaultRun('hc', ['dna', 'hash', repacked]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

export const buildManifest = (input: ManifestInputs): ReleaseManifest => {
  const run = input.run ?? defaultRun;
  const readBytes = input.readBytes ?? defaultReadBytes;
  const now = input.now ?? (() => new Date());
  const installedHash = input.installedHash ?? defaultInstalledHash;

  const sha256 = (path: string) => createHash('sha256').update(readBytes(path)).digest('hex');

  const packageVersion = (
    JSON.parse(readFileSync(`${input.root}/package.json`, 'utf8')) as { version: string }
  ).version;
  const happYaml = readFileSync(`${input.root}/workdir/happ.yaml`, 'utf8');
  const desktopSeed = parseWrapperSeed(input.wrapperConfig);

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
    desktop: {
      networkSeed: desktopSeed,
      networkSeedSource: input.wrapperConfigSource,
      installedDnaHashes: {
        requests_and_offers: installedHash(input.dnaPath, {
          networkSeed: desktopSeed,
          properties: propertiesForRole(happYaml, 'requests_and_offers'),
        }),
        hrea: installedHash(input.hreaDnaPath, {
          networkSeed: desktopSeed,
          properties: propertiesForRole(happYaml, 'hrea'),
        }),
      },
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
    hreaDnaPath: flag(argv, 'hrea-dna'),
    wrapperConfig: readFileSync(flag(argv, 'wrapper-config'), 'utf8'),
    wrapperConfigSource: flag(argv, 'wrapper-config-source'),
  });
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${out}`);
  console.log(JSON.stringify(manifest, null, 2));
}
