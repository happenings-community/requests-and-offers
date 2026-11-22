import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIMEFRAME,
  TIMEFRAME_PRESETS,
  hasEnded,
  sameTimeframe,
  timeframeLabel,
  timeframeOptions
} from '$lib/utils/timeframe';
import type { Timeframe } from '$lib/types/holochain';
import { formatDay } from '$lib/utils/dates';

/**
 * **Timeframes are typed** (#380): a preset, or a window of dates in microseconds.
 * These helpers make one read the same on every screen, and compare two as the zome
 * does.
 */

const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => ms * 1000;
const END = Date.UTC(2026, 11, 1, 12);
const START = Date.UTC(2026, 10, 20, 12);
const window = (start: number | null, end: number): Timeframe => ({
  Dates: { start: start === null ? null : at(start), end: at(end) }
});

describe('timeframeLabel', () => {
  it('names each preset in words', () => {
    expect(timeframeLabel({ Preset: 'WithinAFewDays' })).toBe('Within a few days of agreeing');
    expect(timeframeLabel({ Preset: 'WithinTwoWeeks' })).toBe('Within 2 weeks of agreeing');
    expect(timeframeLabel({ Preset: 'WithinAMonth' })).toBe('Within a month of agreeing');
    expect(timeframeLabel({ Preset: 'Flexible' })).toBe('Flexible');
  });

  it('reads a window by its due date, and by both dates when it has a start', () => {
    const end = formatDay(END);
    const start = formatDay(START);
    expect(timeframeLabel(window(null, END))).toBe(`by ${end}`);
    expect(timeframeLabel(window(START, END))).toBe(`${start} to ${end}`);
  });

  it('reads microseconds, not milliseconds', () => {
    // The date range this replaces read microseconds as milliseconds, which put
    // every date some fifty thousand years ahead.
    expect(timeframeLabel(window(null, END))).toContain('2026');
  });
});

describe('sameTimeframe', () => {
  it('compares by value, so two equal timeframes are the same', () => {
    expect(sameTimeframe({ Preset: 'Flexible' }, { Preset: 'Flexible' })).toBe(true);
    expect(sameTimeframe(window(START, END), window(START, END))).toBe(true);
  });

  it('tells apart presets, windows, and a preset from a window', () => {
    expect(sameTimeframe({ Preset: 'Flexible' }, { Preset: 'WithinAMonth' })).toBe(false);
    expect(sameTimeframe(window(START, END), window(null, END))).toBe(false);
    expect(sameTimeframe(window(null, END), window(null, END + DAY))).toBe(false);
    expect(sameTimeframe({ Preset: 'Flexible' }, window(null, END))).toBe(false);
  });
});

describe('timeframeOptions', () => {
  it('offers the four presets in order', () => {
    expect(timeframeOptions().map((o) => o.value)).toEqual(
      TIMEFRAME_PRESETS.map((preset) => ({ Preset: preset }))
    );
    expect(timeframeOptions({ Preset: 'Flexible' })).toHaveLength(4);
  });

  it("keeps a proposal's own window as the first choice", () => {
    const own = window(START, END);
    const options = timeframeOptions(own);
    expect(options).toHaveLength(5);
    expect(options[0].value).toBe(own);
  });

  it('starts from within two weeks by default', () => {
    expect(DEFAULT_TIMEFRAME).toEqual({ Preset: 'WithinTwoWeeks' });
  });
});

describe('hasEnded', () => {
  it('is true only for a window whose end has passed', () => {
    expect(hasEnded(window(null, END), at(END + 1))).toBe(true);
    expect(hasEnded(window(null, END), at(END - 1))).toBe(false);
    expect(hasEnded({ Preset: 'WithinAFewDays' }, at(END + 365 * DAY))).toBe(false);
  });
});
