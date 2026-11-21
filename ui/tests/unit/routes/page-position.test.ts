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

  // Asked for by Sam on 21 November: the bar stays put while the page scrolls under it,
  // as the design system's NavBar does (z-30 there too, below Skeleton's drawer at z-40).
  // **To make it go red:** drop `sticky` from the wrapper, the scroll padding from
  // app.postcss, or the menu's own scrolling from NavDropdown.svelte.
  it('keeps the bar pinned to the top, and scrolls focus below it', () => {
    const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
    const wrapper = /<div class="([^"]*)">\s*<NavBar/.exec(layout)?.[1].split(' ') ?? [];
    expect(wrapper).toEqual(expect.arrayContaining(['sticky', 'top-0', 'z-30']));
    const navbar = readFileSync('src/lib/components/shared/NavBar.svelte', 'utf8');
    expect(navbar, 'the padding below assumes the bar is h-20').toMatch(
      /<nav class="[^"]*\bh-20\b/
    );
    const css = readFileSync('src/app.postcss', 'utf8');
    expect(css).toMatch(/html\s*\{\s*scroll-padding-top:\s*5\.5rem;/);
    // A long menu opened from the pinned bar scrolls itself, as the page no longer can.
    const dropdown = readFileSync('src/lib/components/shared/NavDropdown.svelte', 'utf8');
    const menu =
      /<div\s+class="([^"]*)"\s+\{id\}\s+role="menu"/.exec(dropdown)?.[1].split(' ') ?? [];
    expect(menu).toEqual(expect.arrayContaining(['max-h-[calc(100vh-6rem)]', 'overflow-y-auto']));
  });
});
