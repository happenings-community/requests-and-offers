import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The root layout once centred a page shorter than the window, so each page sat at a
 * different height and moved when its content changed: choosing a view on My Listings,
 * moving between the Community pages (Sam's walk, 20 November). Read from the source: the
 * root layout needs the whole app to render. **To make it go red:** put `justify-center`
 * back on the root layout's `<main>`.
 */
describe('where a page sits', () => {
  it('starts every page at the top of the window, under the bar', () => {
    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
    const main = /<main class="([^"]*)"/.exec(layout)?.[1].split(' ') ?? [];
    expect(main).toContain('flex-col');
    expect(main).not.toContain('justify-center');
  });
});
