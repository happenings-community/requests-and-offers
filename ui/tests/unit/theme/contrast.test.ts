import { describe, it, expect } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import theme from '../../../src/happening_theme';

/**
 * Text contrast, computed from the theme (#205, #207). WCAG 2.2 AA asks 4.5:1
 * for normal text. Each pairing below is one the app relies on; lowering a
 * colour in `happening_theme.ts` until one fails turns this test red.
 */

const props = theme.properties as Record<string, string>;
const rgb = (token: string): [number, number, number] => {
  const value = props[`--color-${token}`];
  if (!value) throw new Error(`no theme colour ${token}`);
  return value.split(' ').map(Number) as [number, number, number];
};
const WHITE: [number, number, number] = [255, 255, 255];

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;

describe('text contrast in the theme', () => {
  it('computes the WCAG ratio (black on white is 21:1)', () => {
    expect(contrast([0, 0, 0], WHITE)).toBeCloseTo(21, 1);
  });

  it.each([
    ['surface-500', 'surface-50'],
    ['surface-500', 'surface-100'],
    ['surface-500', 'surface-200'],
    ['surface-600', 'surface-100']
  ])('light mode: %s text on %s passes AA', (fg, bg) => {
    expect(contrast(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(AA);
  });

  it('dark mode: surface-300 text on the admin background (surface-800) passes AA', () => {
    expect(contrast(rgb('surface-300'), rgb('surface-800'))).toBeGreaterThanOrEqual(AA);
  });

  it('white text on the purple nav bar (primary-500) passes AA', () => {
    expect(contrast(WHITE, rgb('primary-500'))).toBeGreaterThanOrEqual(AA);
  });

  // A selected option card in the admin's dark mode is the brand colour at
  // 20% over surface-800 (Skeleton's variant-soft), so text there needs more.
  const tinted = (token: string) => {
    const [c, base] = [rgb(token), rgb('surface-800')];
    return c.map((v, i) => Math.round(0.2 * v + 0.8 * base[i])) as [number, number, number];
  };

  it.each([['secondary-500'], ['primary-500']])(
    'dark mode: surface-200 text on a selected %s option card passes AA',
    (tint) => {
      expect(contrast(rgb('surface-200'), tinted(tint))).toBeGreaterThanOrEqual(AA);
    }
  );

  it('dark mode: primary-300 headings pass AA on the admin background and a selected card', () => {
    expect(contrast(rgb('primary-300'), rgb('surface-800'))).toBeGreaterThanOrEqual(AA);
    expect(contrast(rgb('primary-300'), tinted('primary-500'))).toBeGreaterThanOrEqual(AA);
  });

  it('records why the admin needs the dark override: surface-500 on surface-800 fails', () => {
    expect(contrast(rgb('surface-500'), rgb('surface-800'))).toBeLessThan(AA);
  });
});

describe('the admin shell (forced dark mode, #205)', () => {
  // The admin layout adds `dark` to <html>, so grey text there needs a dark
  // shade. These are the files rendered inside that shell.
  const files = [
    ...globSync('src/routes/admin/**/*.svelte'),
    'src/lib/components/mediums-of-exchange/MediumOfExchangeForm.svelte',
    'src/lib/components/mediums-of-exchange/MediumOfExchangeSuggestionForm.svelte',
    'src/lib/components/service-types/ServiceTypeForm.svelte'
  ];

  it('finds the admin files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  const lines = () =>
    files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
    );

  it('gives every surface-400 or surface-500 text a readable dark shade', () => {
    const bare = /(?<![\w:-])text-surface-(400|500)(?![\w-])/;
    const offenders = lines()
      .filter(({ line }) => bare.test(line) && !line.includes('dark:text-surface'))
      .map(({ at }) => at);
    expect(offenders).toEqual([]);
  });

  it('uses no dark shade too dim for the dark background', () => {
    // surface-400 is 3.56:1 on surface-800, primary-400 is 2.57:1.
    const dim = /dark:text-(surface-(400|500|600)|primary-(400|500))(?![\w-])/;
    expect(lines().filter(({ line }) => dim.test(line)).map(({ at }) => at)).toEqual([]);
  });

  it('uses no Skeleton token pair whose dark shade is too dim', () => {
    // `text-surface-500-400-token` is surface-500 in light mode and surface-400
    // in dark mode, which the two checks above do not see.
    const dimPair = /text-(surface-\d{2,3}-(400|500|600)|primary-\d{2,3}-(400|500))-token/;
    expect(lines().filter(({ line }) => dimPair.test(line)).map(({ at }) => at)).toEqual([]);
  });
});

/**
 * Edges of fields and cards (the design system pass, part 4, in `app.postcss`'s components
 * layer). WCAG 2.2 asks 3:1 of what identifies a control or its state (1.4.11). The first
 * test reads the stylesheet, so the pairs checked below are the ones it draws; the rest keep
 * the theme from drifting under them.
 */
describe('edges of fields and cards', () => {
  const NON_TEXT = 3;
  const css = readFileSync('src/app.postcss', 'utf8');
  const rule = (selector: string) => {
    const at = css.indexOf(`${selector} {`);
    if (at < 0) throw new Error(`no rule ${selector} in app.postcss`);
    return css.slice(at, css.indexOf('}', at));
  };
  // primary-200 at 55% over a surface, as the browser composites the focus halo.
  const halo = (under: [number, number, number]) =>
    rgb('primary-200').map((c, i) => 0.55 * c + 0.45 * under[i]) as [number, number, number];

  it('draws the edges this test checks', () => {
    expect(rule('  .input-group')).toContain('rgb(var(--color-surface-500))');
    expect(rule('  .dark .input-group')).toContain('rgb(var(--color-surface-400))');
    expect(rule('  .input-group:focus-within')).toContain('rgb(var(--color-primary-500))');
    expect(rule('  .input-group:focus-within')).toContain('rgb(var(--color-primary-200) / 0.55)');
    expect(rule("  .textarea[aria-invalid='true']")).toContain('rgb(var(--color-error-500))');
    expect(
      rule("  .card:where(a, button):where(:not([class*='variant-'], :disabled)):hover")
    ).toContain('rgb(var(--color-primary-400))');
    expect(
      rule(
        "  :where(.dark) .card:where(a, button):where(:not([class*='variant-'], :disabled)):hover"
      )
    ).toContain('rgb(var(--color-primary-300))');
    expect(rule('  .dark button.card:focus-visible')).toContain('rgb(var(--color-primary-300))');
    expect(rule('  .dark .textarea.input-error')).toContain('rgb(var(--color-surface-700))');
    expect(rule("  .textarea[aria-invalid='true']")).toContain('rgb(var(--color-error-100))');
  });

  it('a field edge (surface-500) stands out on a card and on the page', () => {
    expect(contrast(rgb('surface-500'), WHITE)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrast(rgb('surface-500'), rgb('surface-50'))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it("admin's dark field edge (surface-400) stands out on admin's page and a dark card (surface-800)", () => {
    expect(contrast(rgb('surface-400'), rgb('surface-800'))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it('a focused field (primary-500) and a field in error (error-500) stand out on white', () => {
    expect(contrast(rgb('primary-500'), WHITE)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrast(rgb('error-500'), WHITE)).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it("in admin's dark mode a focused field shows by its halo, which stands out on surface-800", () => {
    // The primary-500 edge itself is close to the dark fill, so the halo carries focus there.
    expect(contrast(halo(rgb('surface-800')), rgb('surface-800'))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it("in admin's dark mode a field in error shows by its halo (error-100), and its text stays readable", () => {
    // The error-500 edge is dim on the dark page; the solid halo carries the state.
    expect(contrast(rgb('error-100'), rgb('surface-800'))).toBeGreaterThanOrEqual(NON_TEXT);
    // Dark mode's text is white, on the surface-700 fill this change gives an error field.
    expect(contrast(WHITE, rgb('surface-700'))).toBeGreaterThanOrEqual(AA);
  });

  it('a card that opens something shows a hover edge you can see: primary-400 on white and on the page, primary-300 in admin', () => {
    expect(contrast(rgb('primary-400'), WHITE)).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrast(rgb('primary-400'), rgb('surface-50'))).toBeGreaterThanOrEqual(NON_TEXT);
    expect(contrast(rgb('primary-300'), rgb('surface-800'))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it("in admin's dark mode the focus ring on a card that opens something (primary-300) stands out", () => {
    expect(contrast(rgb('primary-300'), rgb('surface-800'))).toBeGreaterThanOrEqual(NON_TEXT);
  });
});
