import { describe, it, expect } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Loaded by path: tailwind.config.ts sits outside the tsconfig project that type checks tests.
const configUrl = pathToFileURL(resolve(process.cwd(), 'tailwind.config.ts')).href;
const { default: config } = (await import(/* @vite-ignore */ configUrl)) as {
  default: { theme?: unknown };
};

/**
 * One content width rule for the member pages (dogfooding, 21 November).
 *
 * Two named widths, both defined in `tailwind.config.ts`:
 * - `container` is the page width: listings, tables, directories. It stops
 *   growing at 1280px, so a wide screen centres it instead of stretching it.
 * - `max-w-reading` (48rem, 768px) is the reading column: a conversation, an
 *   exchange, a form read top to bottom. It sits inside a `container`.
 *
 * A page or component that caps its own column beside `container` (`max-w-2xl`,
 * `lg:max-w-4xl`, `max-w-prose`, `max-w-[60rem]`) is a third width, and this test turns
 * red on it, in `src/routes` and `src/lib` alike.
 */

type ContainerTheme = { screens?: Record<string, string> };
const theme = config.theme as {
  container?: ContainerTheme;
  extend?: { maxWidth?: Record<string, string> };
};

describe('page widths', () => {
  it('caps the page container at 1280px', () => {
    const screens = theme.container?.screens;
    expect(screens).toBeDefined();
    const widths = Object.values(screens ?? {}).map((w) => parseInt(w, 10));
    expect(Math.max(...widths)).toBe(1280);
  });

  it('keeps the container steps below 1280px as Tailwind draws them', () => {
    expect(theme.container?.screens).toEqual({
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px'
    });
  });

  it('names the reading column', () => {
    expect(theme.extend?.maxWidth?.reading).toBe('48rem');
  });

  it('gives no page a column width of its own beside container', () => {
    const files = ['src/routes/**/*.svelte', 'src/lib/**/*.svelte'].flatMap((pattern) =>
      globSync(pattern, { cwd: process.cwd() })
    );
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.flatMap((file) =>
      columnWidthsBesideContainer(file, readFileSync(file, 'utf8'))
    );
    expect(offenders).toEqual([]);
  });

  it('catches a width however a class attribute writes it', () => {
    const found = (markup: string) => columnWidthsBesideContainer('x.svelte', markup).length;
    expect(found('<div class="container mx-auto max-w-2xl">')).toBe(1);
    expect(found('<div class="container lg:max-w-4xl">'), 'a breakpoint prefix').toBe(1);
    expect(found('<div class="container mx-auto max-w-prose">')).toBe(1);
    expect(found('<div class="container max-w-[60rem]">'), 'an arbitrary value').toBe(1);
    expect(found('<div class="container !max-w-3xl">'), 'important').toBe(1);
    expect(
      found('<section\n  class="container mx-auto\n    max-w-4xl p-4"\n>'),
      'a class split over lines'
    ).toBe(1);
    expect(found(`<div class="container {wide ? 'max-w-4xl' : ''}">`), 'in a ternary').toBe(1);
    expect(found("<div class='container max-w-2xl'>"), 'single quotes').toBe(1);
    expect(found('<div class={`container max-w-2xl`}>'), 'a template string').toBe(1);
    expect(found('<div class={"container max-w-2xl"}>'), 'a braced string').toBe(1);
    expect(found('<div class="container mx-auto max-w-reading">')).toBe(0);
    expect(found('<div class="container mx-auto max-w-full">')).toBe(0);
    expect(found('<div class="mx-auto max-w-2xl">'), 'no container, no rule').toBe(0);
    expect(
      found('<div class="table-container max-w-2xl">'),
      'another class that ends in container'
    ).toBe(0);
  });
});

/**
 * Every `max-w-*` that sits in a class attribute beside `container`, other than the named
 * reading column and the two that set no width (`full`, `none`). Reads the whole attribute,
 * however many lines it spans, in double or single quotes or in braces (`class={...}` with no
 * braces inside, such as a template string without interpolation), strips the quotes, braces
 * and backticks of a simple expression inside it (`{wide ? 'max-w-4xl' : ''}`),
 * and drops variant prefixes (`lg:`, `dark:`) and `!`, so `lg:max-w-4xl` counts as
 * `max-w-4xl`. A `class:` directive is not read.
 */
function columnWidthsBesideContainer(file: string, source: string): string[] {
  const found: string[] = [];
  for (const m of source.matchAll(/\bclass=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g)) {
    const value = m[1] ?? m[2] ?? m[3];
    const tokens = value
      .split(/\s+/)
      .map((t) => t.replace(/[{}'"`]/g, ''))
      .filter(Boolean);
    if (!tokens.includes('container')) continue;
    for (const token of tokens) {
      const utility = token.split(':').pop()!.replace(/^!/, '');
      if (
        /^max-w-/.test(utility) &&
        !['max-w-full', 'max-w-none', 'max-w-reading'].includes(utility)
      ) {
        const line = source.slice(0, m.index).split('\n').length;
        found.push(`${file}:${line} ${token}`);
      }
    }
  }
  return found;
}
