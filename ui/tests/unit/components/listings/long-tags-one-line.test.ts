import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Dogfooding, 21 November 2026: a long service type ("Holochain Zome Development
 * (Rust)") wrapped onto four lines in its chip, and every row of the Requests and Offers
 * tables grew to about 130px. A tag now stays on one line, cut with an ellipsis where its
 * cell is narrower than its name. The name stays whole in the markup, so a screen reader
 * reads all of it, and the chip's title shows it on hover.
 *
 * Read from the source rather than rendered: both tags load their name from a store
 * over the conductor, and what is pinned here is markup.
 */

const read = (p: string) => readFileSync(resolve(__dirname, '../../../../src', p), 'utf8');

const tags = [
  'lib/components/service-types/ServiceTypeTag.svelte',
  'lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte'
];

/** Each chip the tag draws: the opening tag through its closing tag. */
function chips(src: string): string[] {
  const markup = src.slice(src.indexOf('</script>'));
  return markup.match(/<(span|a)\s[^>]*\bchip\b[^>]*>[\s\S]*?<\/\1>/g) ?? [];
}

describe('a tag in a listing table stays on one line', () => {
  it.each(tags)('%s caps every chip at its cell and keeps it on one line', (file) => {
    const all = chips(read(file));
    expect(all.length).toBeGreaterThan(0);
    for (const chip of all) {
      const cls = chip.match(/class="([^"]*)"/)?.[1] ?? '';
      expect(cls, chip).toMatch(/\bmax-w-full\b/);
      expect(cls, chip).toMatch(/\bwhitespace-nowrap\b/);
    }
  });

  it.each(tags)('%s cuts the text, not the chip, with an ellipsis', (file) => {
    for (const chip of chips(read(file))) {
      expect(chip, chip).toMatch(/<span class="[^"]*\btruncate\b[^"]*">/);
    }
  });

  it.each(tags)('%s puts the name in the title of the chip that shows it', (file) => {
    const named = chips(read(file)).filter((c) => /\{displayText\}/.test(c));
    expect(named.length).toBeGreaterThan(0);
    for (const chip of named) {
      expect(chip).toMatch(/title=\{/);
    }
  });
});
