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
 * A page that caps its own column with a raw size (`max-w-2xl`, `max-w-3xl`)
 * beside `container` is a third width, and this test turns red on it.
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
    const files = globSync('src/routes/**/*.svelte', { cwd: process.cwd() });
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const cls = line.match(/class="([^"]*)"/)?.[1];
          if (!cls) return;
          const tokens = cls.split(/\s+/);
          if (!tokens.includes('container')) return;
          const raw = tokens.find((t) => /^max-w-(\d?xl|lg|md|sm|xs|screen-\w+)$/.test(t));
          if (raw) offenders.push(`${file}:${i + 1} ${raw}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
