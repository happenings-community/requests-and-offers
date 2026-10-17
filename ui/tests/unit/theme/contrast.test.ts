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

  it('gives every surface-400 or surface-500 text a readable dark shade', () => {
    const bare = /(?<![\w:-])text-surface-(400|500)(?![\w-])/;
    const offenders = files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${file}:${i + 1}` }))
        .filter(({ line }) => bare.test(line) && !line.includes('dark:text-surface'))
        .map(({ at }) => at)
    );
    expect(offenders).toEqual([]);
  });
});
