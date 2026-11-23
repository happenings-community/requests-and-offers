import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  isAgentPubKey,
  keyRelease,
  readProgenitorKey,
  setProgenitorKey
} from '../release-progenitor.ts';

const root = join(import.meta.dir, '..', '..');
const script = join(root, 'scripts', 'release-progenitor.ts');

// 53 characters, `uhCAk` first: the shape of a real AgentPubKey, not a real key.
const KEY = 'uhCAkAbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdEfGhIj';

const manifest = (progenitorLines: string[]) => `---
manifest_version: "0"
name: requests_and_offers
roles:
  - name: requests_and_offers
    dna:
      path: "../dnas/requests_and_offers/workdir/requests_and_offers.dna"
      modifiers:
        network_seed: "requests_and_offers_alpha"
        properties:
${progenitorLines.join('\n')}
      clone_limit: 0
  - name: hrea
    dna:
      path: "./hrea.dna"
      modifiers:
        network_seed: "hrea_requests_and_offers_alpha"
        properties: ~
      clone_limit: 0
`;

const dev = manifest(['          progenitor_pubkey: ~']);

describe('isAgentPubKey', () => {
  it('accepts the shape of an AgentPubKey', () => {
    expect(KEY).toHaveLength(53);
    expect(isAgentPubKey(KEY)).toBe(true);
  });

  it('refuses the wrong prefix, the wrong length and stray characters', () => {
    expect(isAgentPubKey(KEY.replace('uhCAk', 'uhC0k'))).toBe(false);
    expect(isAgentPubKey(`${KEY}A`)).toBe(false);
    expect(isAgentPubKey(KEY.slice(0, 52))).toBe(false);
    expect(isAgentPubKey(`${KEY.slice(0, 52)}+`)).toBe(false);
    expect(isAgentPubKey('')).toBe(false);
    expect(isAgentPubKey('~')).toBe(false);
  });
});

describe('setProgenitorKey', () => {
  it('changes the one line and nothing else', () => {
    const verdict = setProgenitorKey(dev, KEY);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.yaml).toBe(dev.replace('progenitor_pubkey: ~', `progenitor_pubkey: ${KEY}`));
    expect(readProgenitorKey(verdict.yaml)).toBe(KEY);
  });

  it('keeps a trailing comment on the line', () => {
    const verdict = setProgenitorKey(manifest(['          progenitor_pubkey: ~  # dev mode']), KEY);
    expect(verdict.ok && verdict.yaml).toContain(`progenitor_pubkey: ${KEY}  # dev mode`);
  });

  it('replaces a key already there', () => {
    const other = `uhCAk${'Z'.repeat(48)}`;
    const verdict = setProgenitorKey(manifest([`          progenitor_pubkey: ${other}`]), KEY);
    expect(verdict.ok && readProgenitorKey(verdict.yaml)).toBe(KEY);
  });

  it('refuses a malformed key before it reads the file', () => {
    const verdict = setProgenitorKey(dev, 'not-a-key');
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('uhCAk');
  });

  it('refuses a manifest with no progenitor line', () => {
    const verdict = setProgenitorKey(manifest(['          other: 1']), KEY);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('found 0');
  });

  it('refuses a manifest with two progenitor lines', () => {
    const twice = `${dev}# stray\n  progenitor_pubkey: ~\n`;
    const verdict = setProgenitorKey(twice, KEY);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('found 2');
  });

  it('refuses a line that is not the requests_and_offers role property', () => {
    const wrongRole = dev
      .replace('          progenitor_pubkey: ~\n', '          other: 1\n')
      .replace('        properties: ~\n', '        properties:\n          progenitor_pubkey: ~\n');
    const verdict = setProgenitorKey(wrongRole, KEY);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('not the requests_and_offers role');
  });
});

describe('keyRelease', () => {
  const run = (argv: string[], env: Record<string, string | undefined> = {}) => {
    const files = new Map<string, string>([['workdir/happ.yaml', dev]]);
    const outcome = keyRelease({
      argv,
      env,
      read: (path) => files.get(path) ?? '',
      write: (path, text) => void files.set(path, text)
    });
    return { outcome, files };
  };

  it('takes the key from --key', () => {
    const { outcome, files } = run(['--key', KEY]);
    expect(outcome.code).toBe(0);
    expect(readProgenitorKey(files.get('workdir/happ.yaml') ?? '')).toBe(KEY);
  });

  it('takes the key from PROGENITOR_PUBKEY', () => {
    const { outcome, files } = run([], { PROGENITOR_PUBKEY: KEY });
    expect(outcome.code).toBe(0);
    expect(readProgenitorKey(files.get('workdir/happ.yaml') ?? '')).toBe(KEY);
  });

  it('prefers --key over the environment', () => {
    const other = `uhCAk${'Y'.repeat(48)}`;
    const { files } = run(['--key', KEY], { PROGENITOR_PUBKEY: other });
    expect(readProgenitorKey(files.get('workdir/happ.yaml') ?? '')).toBe(KEY);
  });

  it('exits 1 with a plain message when there is no key, and leaves the file alone', () => {
    const { outcome, files } = run([]);
    expect(outcome.code).toBe(1);
    expect(outcome.stderr.join('\n')).toContain('No progenitor key');
    expect(files.get('workdir/happ.yaml')).toBe(dev);
  });

  it('treats an empty repository variable as no key', () => {
    expect(run([], { PROGENITOR_PUBKEY: '' }).outcome.code).toBe(1);
    expect(run([], { PROGENITOR_PUBKEY: '  ' }).outcome.code).toBe(1);
  });

  it('exits 1 on a malformed key', () => {
    const { outcome, files } = run(['--key', 'uhCAkTooShort']);
    expect(outcome.code).toBe(1);
    expect(outcome.stderr.join('\n')).toContain('53 characters');
    expect(files.get('workdir/happ.yaml')).toBe(dev);
  });

  it('with --allow-dev-mode and no key, leaves the dev line and warns loudly', () => {
    const { outcome, files } = run(['--allow-dev-mode']);
    expect(outcome.code).toBe(0);
    expect(outcome.stderr.join('\n')).toContain('WARNING');
    expect(outcome.stderr.join('\n')).toContain('never publish');
    expect(files.get('workdir/happ.yaml')).toBe(dev);
  });

  it('with --allow-dev-mode and a key, still writes the key', () => {
    const { outcome, files } = run(['--allow-dev-mode', '--key', KEY]);
    expect(outcome.code).toBe(0);
    expect(readProgenitorKey(files.get('workdir/happ.yaml') ?? '')).toBe(KEY);
  });

  it('with --allow-dev-mode, still refuses a malformed key', () => {
    expect(run(['--allow-dev-mode', '--key', 'nope']).outcome.code).toBe(1);
  });

  it('refuses an unknown flag', () => {
    expect(run(['--bogus']).outcome.code).toBe(2);
  });

  it('prints its usage for --help', () => {
    const { outcome } = run(['--help']);
    expect(outcome.code).toBe(0);
    expect(outcome.stdout.join('\n')).toContain('--allow-dev-mode');
  });
});

describe('the repository manifest', () => {
  const happYaml = readFileSync(join(root, 'workdir', 'happ.yaml'), 'utf8');

  it('stays in development mode: only a release build writes the key', () => {
    expect(readProgenitorKey(happYaml)).toBeNull();
  });

  it('holds exactly one line the script can replace', () => {
    const verdict = setProgenitorKey(happYaml, KEY);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    const before = happYaml.split('\n');
    const after = verdict.yaml.split('\n');
    expect(after).toHaveLength(before.length);
    expect(after.filter((line, i) => line !== before[i])).toHaveLength(1);
  });
});

describe('the command line', () => {
  const spawn = (args: string[], env: Record<string, string> = {}) =>
    Bun.spawnSync(['bun', script, ...args], {
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env }
    });

  it('keys a manifest file in place and exits 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'release-progenitor-'));
    try {
      const file = join(dir, 'happ.yaml');
      writeFileSync(file, dev);
      const result = spawn(['--happ', file], { PROGENITOR_PUBKEY: KEY });
      expect(result.exitCode).toBe(0);
      expect(readProgenitorKey(readFileSync(file, 'utf8'))).toBe(KEY);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits 1 and says why when the key is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'release-progenitor-'));
    try {
      const file = join(dir, 'happ.yaml');
      writeFileSync(file, dev);
      const result = spawn(['--happ', file]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString()).toContain('No progenitor key');
      expect(readFileSync(file, 'utf8')).toBe(dev);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
