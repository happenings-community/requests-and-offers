import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { checkReadme, markedVersion } from '../release-readme.ts';

const readme = (marker: string) => `# Requests and Offers\n\n${marker}\n\nSome text.\n`;

describe('markedVersion', () => {
  it('reads the marker, spaces or not', () => {
    expect(markedVersion(readme('<!-- release-ready: 0.6.0-alpha.2 -->'))).toBe('0.6.0-alpha.2');
    expect(markedVersion(readme('<!--release-ready:0.6.0-->'))).toBe('0.6.0');
  });

  it('is undefined when there is no marker', () => {
    expect(markedVersion(readme(''))).toBeUndefined();
  });

  it('refuses two markers', () => {
    expect(() =>
      markedVersion(readme('<!-- release-ready: 0.6.0 -->\n<!-- release-ready: 0.6.1 -->'))
    ).toThrow(/2 release-ready markers/);
  });
});

describe('checkReadme', () => {
  it('passes when the marker names the version, with or without the tag prefix', () => {
    expect(checkReadme(readme('<!-- release-ready: 0.6.0-alpha.3 -->'), 'v0.6.0-alpha.3')).toEqual({ ok: true });
    expect(checkReadme(readme('<!-- release-ready: 0.6.0-alpha.3 -->'), '0.6.0-alpha.3')).toEqual({ ok: true });
  });

  it('refuses a marker left at the previous release', () => {
    const verdict = checkReadme(readme('<!-- release-ready: 0.6.0-alpha.2 -->'), 'v0.6.0-alpha.3');
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('last re-read for 0.6.0-alpha.2, not 0.6.0-alpha.3');
  });

  it('refuses a README with no marker', () => {
    const verdict = checkReadme(readme(''), 'v0.6.0');
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("no '<!-- release-ready: 0.6.0 -->' marker");
  });

  it('does not take a prefix of the version for the version', () => {
    expect(checkReadme(readme('<!-- release-ready: 0.6.0 -->'), 'v0.6.0-alpha.3').ok).toBe(false);
  });
});

describe('the repository README', () => {
  it('carries the marker for the version in package.json', () => {
    const root = `${import.meta.dir}/../..`;
    const { version } = JSON.parse(readFileSync(`${root}/package.json`, 'utf8')) as { version: string };
    expect(markedVersion(readFileSync(`${root}/README.md`, 'utf8'))).toBe(version);
  });
});
