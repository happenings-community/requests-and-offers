import { describe, it, expect } from 'vitest';
import { globSync, readFileSync } from 'node:fs';
import { formatDay, formatDateTime, formatTime } from '$lib/utils/dates';
import { formatWhen } from '$lib/utils/exchange-ui';
import { formatDate } from '$lib/utils';

/**
 * **One date format across the app (F7, dogfooding 21 November).**
 *
 * The same day read three ways: "21 nov. 2026" on the exchange pages (the browser's
 * locale, French on Soushi's machine, inside an English sentence), "Nov 21, 2026, 04:27 PM"
 * on the listings (en-US) and "21 Nov 2026, 16:38" on Blocked members (en-GB). The app is
 * written in English, so dates are written in English too, whatever the browser's
 * language; only the time zone is the member's own.
 */

// A local wall-clock time, so the expectations hold in any time zone the suite runs in.
const AT = new Date(2026, 10, 21, 16, 38).getTime();

describe('the shared date formatter', () => {
  it('writes a day as "21 Nov 2026"', () => {
    expect(formatDay(AT)).toBe('21 Nov 2026');
  });

  it('can leave the year out', () => {
    expect(formatDay(AT, { withYear: false })).toBe('21 Nov');
  });

  it('writes a time on the 24-hour clock', () => {
    expect(formatTime(AT)).toBe('16:38');
  });

  it('writes a moment as "21 Nov 2026, 16:38"', () => {
    expect(formatDateTime(AT)).toBe('21 Nov 2026, 16:38');
  });

  it('accepts a Date as well as milliseconds', () => {
    expect(formatDateTime(new Date(AT))).toBe('21 Nov 2026, 16:38');
  });

  it('is what the exchange pages and the listings use', () => {
    expect(formatWhen(AT)).toBe('21 Nov 2026');
    expect(formatDate(new Date(AT))).toBe('21 Nov 2026, 16:38');
  });
});

/**
 * **To make this go red:** format a date with `toLocaleDateString`, `toLocaleString`,
 * `toLocaleTimeString` or `new Intl.DateTimeFormat` anywhere but `utils/dates.ts`.
 */
describe('nothing formats a date by itself', () => {
  // The hREA test page belongs to the hREA dashboard work, which owns its own files.
  const EXEMPT = new Set([
    'src/lib/utils/dates.ts',
    'src/lib/components/hrea/test-page/ProposalManager.svelte'
  ]);
  const files = [...globSync('src/**/*.ts'), ...globSync('src/**/*.svelte')].filter(
    (f) => !EXEMPT.has(f)
  );

  it('finds the sources to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('routes every date through utils/dates.ts', () => {
    const offenders: string[] = [];
    const pattern = /\.toLocale(Date|Time)?String\(|new Intl\.DateTimeFormat\(/;
    for (const file of files) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (pattern.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
