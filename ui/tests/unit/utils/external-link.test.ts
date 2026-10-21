import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { externalHref } from '$lib/utils/external-link';

describe('externalHref: which typed links become links', () => {
  it('opens web addresses', () => {
    expect(externalHref('https://example.org/page?x=1')).toBe('https://example.org/page?x=1');
    expect(externalHref('http://example.org')).toBe('http://example.org/');
    expect(externalHref('  https://example.org  ')).toBe('https://example.org/');
  });

  it('takes a bare address as https, which is what a member typing it means', () => {
    expect(externalHref('example.org')).toBe('https://example.org/');
    expect(externalHref('www.example.org/about')).toBe('https://www.example.org/about');
  });

  it('never opens a link that would run code or carry its own content', () => {
    for (const text of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      ' javascript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd'
    ]) {
      expect(externalHref(text), text).toBeNull();
    }
  });

  it('shows anything that is not an address as text', () => {
    for (const text of [
      '',
      '   ',
      'just words',
      'mailto:a@example.org',
      '/users/abc',
      null,
      undefined
    ]) {
      expect(externalHref(text), String(text)).toBeNull();
    }
  });
});

/**
 * Every link that opens a new window shows text another member typed, so it goes through
 * `ExternalLink`. **To make this go red:** write `<a href={link} target="_blank">` in a
 * component again.
 */
describe('links that open a new window', () => {
  const SRC = join(__dirname, '../../../src');
  const svelteFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return svelteFiles(path);
      return name.endsWith('.svelte') ? [path] : [];
    });

  it('are written only in ExternalLink', () => {
    const offenders = svelteFiles(SRC)
      .filter((file) => !file.endsWith(join('shared', 'ExternalLink.svelte')))
      .filter((file) => /target=["']_blank["']/.test(readFileSync(file, 'utf8')))
      .map((file) => file.slice(SRC.length + 1));
    expect(offenders).toEqual([]);
  });
});
