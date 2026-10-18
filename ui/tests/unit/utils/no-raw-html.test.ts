import { describe, expect, it } from 'vitest';
import { globSync, readFileSync } from 'node:fs';

/**
 * Every {@html} in the app goes through a sanitiser (#211). The unit suite
 * does not mount components, so this reads the source: any {@html x} whose
 * expression is not safeHtml(...) or a value sanitised by DOMPurify fails.
 */
const files = globSync('src/**/*.svelte');

describe('raw HTML in components', () => {
  it('finds the components to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('renders {@html} only through a sanitiser', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\{@html\s+([^}]+)\}/g)) {
        const expr = match[1].trim();
        const sanitised =
          /^safeHtml\(/.test(expr) ||
          new RegExp(`\\b${expr}\\s*=\\s*\\$derived\\(\\s*DOMPurify\\.sanitize\\(`).test(source);
        if (!sanitised) offenders.push(`${file}: {@html ${expr}}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
