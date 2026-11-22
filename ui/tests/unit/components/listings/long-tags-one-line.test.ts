import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Dogfooding, 21 November 2026: a long service type ("Holochain Zome Development
 * (Rust)") wrapped onto four lines in its chip, and every row of the Requests and Offers
 * tables grew to about 130px. A tag now stays on one line, cut with an ellipsis where its
 * cell is narrower than its name. The name stays whole in the markup, so a screen reader
 * reads all of it, and when it is cut the chip draws it above itself on hover (ChipTip),
 * since Electron on macOS does not show the title.
 *
 * Read from the source: what is pinned here is markup. That the tip shows only when the
 * text is cut, and measures the right element, is rendered in `tag-tip.test.ts`.
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
      expect(chip, chip).toMatch(/<span class="[^"]*\btruncate\b[^"]*"[^>]*>/);
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

/**
 * A cut name has to be readable: Electron on macOS shows no `title` (see NavTip), so the
 * named chip draws the whole name above itself (ChipTip) when its text is actually cut,
 * measured on hover. An error chip does the same with the whole error. **To make it go red:** drop the ChipTip from a tag.
 */
describe('a cut name can be read on hover', () => {
  it.each(tags)('%s draws the whole name above a cut chip', (file) => {
    const src = read(file);
    expect(src).toMatch(/import ChipTip from '\$lib\/components\/shared\/ChipTip\.svelte'/);
    expect(src).toMatch(/const measure = \(\) => \(cut = isCut\(nameEl\)\)/);
    // The named chip's tag runs to its own closing tag, past the inner text span.
    const markup = src.slice(src.indexOf('</script>'));
    const named = (
      markup.match(
        /<(span|a)\s[^>]*\bchip\b[^>]*>(?:(?!<\/?(?:span|a)\b[^>]*\bchip\b)[\s\S])*?<\/\1>\s*(?:\{#if cut\}[\s\S]*?\{\/if\}\s*<\/\1>)?/g
      ) ?? []
    ).filter((c) => /\{displayText\}/.test(c));
    expect(named.length).toBeGreaterThan(0);
    for (const chip of named) {
      // Each as a whole class on its own: the class sorter moves them apart, and
      // `group-hover:` is not `group`.
      const classes = (chip.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
      expect(classes, chip).toContain('group');
      expect(classes, chip).toContain('relative');
      expect(chip, chip).toMatch(/use:measureOnHover=\{measure\}/);
      expect(chip, chip).toMatch(/bind:this=\{nameEl\}/);
      expect(chip, chip).toMatch(/\{#if cut\}<ChipTip text=\{displayText\} \/>\{\/if\}/);
    }
  });

  it.each(tags)('%s draws the whole error above a cut error chip', (file) => {
    const markup = read(file).slice(read(file).indexOf('</script>'));
    const errorChip =
      markup.match(/<span\s[^>]*\bvariant-soft-error\b[\s\S]*?\{\/if\}\s*<\/span>/)?.[0] ?? '';
    expect(errorChip).toMatch(/use:measureOnHover=\{measure\}/);
    expect(errorChip).toMatch(/\{#if cut\}<ChipTip text=\{`Error loading [^`]+`\} \/>\{\/if\}/);
    const classes = (errorChip.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/);
    expect(classes).toContain('group');
    expect(classes).toContain('relative');
  });
});
