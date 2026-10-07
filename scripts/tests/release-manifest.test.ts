import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  buildManifest,
  parseHolochainVersion,
  parseWrapperSeed,
  propertiesForRole,
  seedForRole,
  versionFromTag,
  withInstalledModifiers,
} from '../release-manifest.ts';

const root = join(import.meta.dir, '..', '..');

describe('parseHolochainVersion', () => {
  it('reads the version out of the real hc output shape', () => {
    expect(parseHolochainVersion('holochain_cli 0.6.1')).toBe('0.6.1');
  });

  it('refuses output it does not recognise rather than guessing', () => {
    expect(() => parseHolochainVersion('hc 0.6.1')).toThrow(/unrecognised/);
    expect(() => parseHolochainVersion('')).toThrow(/unrecognised/);
  });
});

describe('seedForRole', () => {
  // Read from the real manifest, not a fixture: a fixture would keep passing
  // after someone renames a role in workdir/happ.yaml.
  const happYaml = readFileSync(join(root, 'workdir', 'happ.yaml'), 'utf8');

  it('finds both roles the hApp actually declares', () => {
    expect(seedForRole(happYaml, 'requests_and_offers')).toBe('requests_and_offers_alpha');
    expect(seedForRole(happYaml, 'hrea')).toBe('hrea_requests_and_offers_alpha');
  });

  it('fails on a role that is not there', () => {
    expect(() => seedForRole(happYaml, 'nope')).toThrow(/not found/);
  });

  it('fails on a role whose seed is null, which would mean an unnamespaced network', () => {
    const seedless = `---
roles:
  - name: requests_and_offers
    dna:
      modifiers:
        network_seed: ~
`;
    expect(() => seedForRole(seedless, 'requests_and_offers')).toThrow(/no network_seed/);
  });
});

describe('parseWrapperSeed', () => {
  // Shaped like the wrapper's real kangaroo.config.ts, trimmed to what matters.
  const config = `export default defineConfig({
  version: '0.6.0-alpha.1',
  networkSeed: 'alpha1-iroh-2026',
  bootstrapUrl: 'https://dev-test-bootstrap2.holochain.org/',
});`;

  it('reads the desktop seed out of the wrapper config', () => {
    expect(parseWrapperSeed(config)).toBe('alpha1-iroh-2026');
  });

  it('accepts double quotes', () => {
    expect(parseWrapperSeed('  networkSeed: "other-seed",')).toBe('other-seed');
  });

  it('refuses a config with no seed rather than falling back to the hApp seed', () => {
    expect(() => parseWrapperSeed("export default defineConfig({ version: '1' });")).toThrow(
      /no `networkSeed/
    );
  });
});

describe('propertiesForRole', () => {
  const happYaml = readFileSync(join(root, 'workdir', 'happ.yaml'), 'utf8');

  it('returns the properties the hApp manifest overrides for a role', () => {
    expect(propertiesForRole(happYaml, 'requests_and_offers')).toEqual({ progenitor_pubkey: null });
  });

  it('returns nothing for a role with null properties', () => {
    expect(propertiesForRole(happYaml, 'hrea')).toBeUndefined();
  });
});

describe('withInstalledModifiers', () => {
  const dnaYaml = `manifest_version: '0'
name: hrea
integrity:
  network_seed: null
  properties: null
  zomes: []
`;

  it('sets the seed the install will apply', () => {
    const out = Bun.YAML.parse(withInstalledModifiers(dnaYaml, { networkSeed: 'alpha1-iroh-2026' })) as {
      integrity: { network_seed: string; properties: unknown };
    };
    expect(out.integrity.network_seed).toBe('alpha1-iroh-2026');
    expect(out.integrity.properties).toBeNull();
  });

  it('applies the role properties when it has some', () => {
    const out = Bun.YAML.parse(
      withInstalledModifiers(dnaYaml, { networkSeed: 's', properties: { progenitor_pubkey: null } })
    ) as { integrity: { properties: unknown } };
    expect(out.integrity.properties).toEqual({ progenitor_pubkey: null });
  });
});

describe('versionFromTag', () => {
  it('strips the v and accepts a matching package version', () => {
    expect(versionFromTag('v0.6.0-alpha.2', '0.6.0-alpha.2')).toBe('0.6.0-alpha.2');
  });

  it('stops the release when the tag and package.json disagree', () => {
    expect(() => versionFromTag('v0.6.0-alpha.2', '0.6.0-alpha.1')).toThrow(
      /tag v0\.6\.0-alpha\.2 says version 0\.6\.0-alpha\.2 but package\.json says 0\.6\.0-alpha\.1/
    );
  });
});

describe('buildManifest', () => {
  const version = (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string })
    .version;

  const run = (command: string, args: string[]) => {
    if (args[0] === '--version') return 'holochain_cli 0.6.1';
    if (args[0] === 'dna' && args[1] === 'hash') return 'uhC0kFAKEHASHFORTESTS';
    throw new Error(`unexpected command: ${command} ${args.join(' ')}`);
  };

  const inputs = {
    root,
    tag: `v${version}`,
    happPath: '/tmp/requests_and_offers.happ',
    webhappPath: '/tmp/requests_and_offers.webhapp',
    dnaPath: '/tmp/requests_and_offers.dna',
    hreaDnaPath: '/tmp/hrea.dna',
    wrapperConfig: "export default defineConfig({\n  networkSeed: 'alpha1-iroh-2026',\n});",
    wrapperConfigSource: 'happenings-community/requests-and-offers-kangaroo-electron@release:kangaroo.config.ts',
    // Stands in for the unpack, patch, pack, hash round trip, and records what
    // it was asked to hash so the test can see the wrapper's seed arrive.
    installedHash: (path: string, modifiers: { networkSeed: string }) =>
      `installed(${basename(path)},${modifiers.networkSeed})`,
    run,
    readBytes: (path: string) => new TextEncoder().encode(`bytes of ${path}`),
    now: () => new Date('2026-09-19T21:00:00.000Z'),
  };

  it('measures every field rather than accepting it', () => {
    const manifest = buildManifest(inputs);
    expect(manifest).toEqual({
      version,
      tag: `v${version}`,
      generatedAt: '2026-09-19T21:00:00.000Z',
      holochainVersion: '0.6.1',
      // Digests computed from the injected bytes, written out rather than read
      // back off the result: a test that asserts a value against itself cannot
      // go red when the hashing changes.
      happ: {
        file: 'requests_and_offers.happ',
        sha256: '388779c6e2e857613c2830d41df804ad0b8c825129a5610e6fb16d1c3442b689',
      },
      webhapp: {
        file: 'requests_and_offers.webhapp',
        sha256: 'e2b8a2ef035b4b70711bd69daae34ddf07d41bb98f89901bb0660ef2192021ea',
      },
      dna: { file: 'requests_and_offers.dna', hash: 'uhC0kFAKEHASHFORTESTS', appliesModifiers: false },
      network: {
        requestsAndOffersSeed: 'requests_and_offers_alpha',
        hreaSeed: 'hrea_requests_and_offers_alpha',
      },
      desktop: {
        networkSeed: 'alpha1-iroh-2026',
        networkSeedSource:
          'happenings-community/requests-and-offers-kangaroo-electron@release:kangaroo.config.ts',
        installedDnaHashes: {
          requests_and_offers: 'installed(requests_and_offers.dna,alpha1-iroh-2026)',
          hrea: 'installed(hrea.dna,alpha1-iroh-2026)',
        },
      },
    });
  });

  it('gives different artefacts different digests', () => {
    const manifest = buildManifest(inputs);
    expect(manifest.happ.sha256).toHaveLength(64);
    expect(manifest.happ.sha256).not.toBe(manifest.webhapp.sha256);
  });

  it('keeps the hApp seeds and the desktop seed apart', () => {
    const manifest = buildManifest(inputs);
    expect(manifest.network.requestsAndOffersSeed).toBe('requests_and_offers_alpha');
    expect(manifest.desktop.networkSeed).toBe('alpha1-iroh-2026');
  });

  it('refuses to build a manifest for a tag package.json does not agree with', () => {
    expect(() => buildManifest({ ...inputs, tag: 'v9.9.9' })).toThrow(/Bump package\.json/);
  });
});
