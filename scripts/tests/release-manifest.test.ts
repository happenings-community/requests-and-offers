import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildManifest,
  parseHolochainVersion,
  seedForRole,
  versionFromTag,
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
    });
  });

  it('gives different artefacts different digests', () => {
    const manifest = buildManifest(inputs);
    expect(manifest.happ.sha256).toHaveLength(64);
    expect(manifest.happ.sha256).not.toBe(manifest.webhapp.sha256);
  });

  it('refuses to build a manifest for a tag package.json does not agree with', () => {
    expect(() => buildManifest({ ...inputs, tag: 'v9.9.9' })).toThrow(/Bump package\.json/);
  });
});
