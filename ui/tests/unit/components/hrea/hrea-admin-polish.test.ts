import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { encodeHashToBase64 } from '@holochain/client';
import { hashLabel } from '$lib/utils/hash-label';
import { findByRoot } from '$lib/utils/medium-by-root';

// The admin's hREA pages, polished for review (20 November). The suite does not mount
// these components (see hrea-admin-entry.test.ts), so the markup checks read the source.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const TEST_PAGE = 'src/lib/components/hrea/test-page';

describe('hashLabel', () => {
  it('shows a hash kept as comma-separated bytes as the end of its base64', () => {
    const bytes = new Uint8Array(Array.from({ length: 39 }, (_, i) => i));
    const label = hashLabel(bytes.toString());
    expect(label).toBe(`…${encodeHashToBase64(bytes).slice(-8)}`);
    expect(label).not.toMatch(/,/);
  });

  it('shortens other text, and says unknown for none', () => {
    expect(hashLabel('uhCkkAbcdefghijklmnop')).toBe('…ijklmnop');
    expect(hashLabel('short')).toBe('short');
    expect(hashLabel(null)).toBe('unknown');
  });
});

describe('the economic-flow graph', () => {
  const src = read('src/lib/components/hrea/HreaDashboard.svelte');

  it('fits the panel and zooms and pans, rather than scrolling sideways', () => {
    expect(src).not.toMatch(/hrea-stage-scroll/);
    expect(src).toMatch(/data-testid="hrea-viewport"/);
    expect(src).toMatch(/transform: translate\(\{pan\.x\}px, \{pan\.y\}px\) scale\(\{scale\}\)/);
    for (const label of ['Zoom out', 'Zoom in']) expect(src).toContain(`aria-label="${label}"`);
    expect(src).toMatch(/aria-pressed=\{zoom === null\}/);
  });

  it('can be moved and zoomed from the keyboard, and each node opened by focus or a tap', () => {
    expect(src).toMatch(/onkeydown=\{onKey\}/);
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])
      expect(src).toContain(key);
    expect(src).toMatch(/onfocus=\{\(\) => \(hover = n\.id\)\}/);
    expect(src).toMatch(/role="listitem"\s*tabindex="0"/);
  });
});

describe('the Test managers', () => {
  const files = readdirSync(resolve(process.cwd(), TEST_PAGE)).filter((f) => f.endsWith('.svelte'));

  it('find a medium of exchange by the hash it has', () => {
    const moe = read(`${TEST_PAGE}/MediumOfExchangeResourceSpecManager.svelte`);
    expect(moe).not.toMatch(/moe\.actionHash/);
    expect(moe).toMatch(/findByRoot\(mediumsOfExchangeStore\.approvedMediumsOfExchange/);
    expect(moe).toMatch(/roots\.track\(/);
  });

  describe('findByRoot', () => {
    const usd = { original_action_hash: '9,9,2', name: 'USD' }; // listed at its approval revision
    const hours = { original_action_hash: '7,7,1', name: 'Hours' };
    const roots = new Map([
      ['9,9,2', '9,9,1'], // the approval revision's root is the first revision
      ['9,9,1', '9,9,1'],
      ['7,7,1', '7,7,1']
    ]);

    it('finds a medium listed at a later revision than the note names', () => {
      expect(findByRoot([hours, usd], '9,9,1', roots)).toBe(usd);
      // Without the roots, the revision does not match.
      expect(findByRoot([hours, usd], '9,9,1', new Map())).toBeNull();
    });

    it('matches exactly before roots are resolved, and never by name', () => {
      expect(findByRoot([hours, usd], '7,7,1', new Map())).toBe(hours);
      const twin = { original_action_hash: '5,5,5', name: 'USD' };
      expect(findByRoot([twin], '9,9,1', roots)).toBeNull();
    });

    it('finds nothing for a note whose medium is not approved', () => {
      expect(findByRoot([hours], '9,9,1', roots)).toBeNull();
    });
  });

  it('give every coloured text a shade for dark mode, the admin area being dark', () => {
    for (const f of files) {
      const src = read(`${TEST_PAGE}/${f}`);
      for (const [, classes] of src.matchAll(/class="([^"]*)"/g)) {
        const weak = classes
          .split(/\s+/)
          .filter((c) =>
            /^text-(primary|secondary|tertiary|success|warning|error|surface|gray)-\d{3}$/.test(c)
          );
        if (weak.length) expect(classes, f).toMatch(/(^|\s)dark:text-/);
      }
    }
  });

  it('show hashes as labels, and no longer call the sync a placeholder', () => {
    for (const f of files) {
      const src = read(`${TEST_PAGE}/${f}`);
      expect(src, f).not.toMatch(/Hash: \{[^}]*\.slice\(-12\)/);
      expect(src, f).not.toMatch(/placeholder\. This demonstrates/);
    }
  });
});
