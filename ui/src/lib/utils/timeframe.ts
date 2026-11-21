import type { Timeframe, TimeframePreset } from '$lib/types/holochain';
import { EXCHANGE_STRINGS } from '$lib/strings/exchanges.strings';
import { fill } from '$lib/strings/fill';
import { formatDay } from '$lib/utils/dates';

/**
 * Timeframes (#380): when a listing is needed or offered, or an agreement delivered.
 *
 * A timeframe is a preset or a window of dates, typed end to end, so the counter rule
 * compares values and the hREA mirror can set a due date. A preset is a turnaround
 * counted from agreeing; a window is calendar dates. A window's `start` and `end` are
 * instants, not days: a date input, when one is added (part 2 of #370), stores the end of
 * the chosen day in the author's time zone (never UTC midnight), and a reader sees it in
 * their own. These helpers are shared by
 * the listing cards, the propose and counter pages, the exchange page and the
 * conversation cards, so a timeframe reads the same everywhere.
 */

const S = EXCHANGE_STRINGS.timeframe;

/** The presets the propose and counter pages offer, in their order. */
export const TIMEFRAME_PRESETS: readonly TimeframePreset[] = [
  'WithinAFewDays',
  'WithinTwoWeeks',
  'WithinAMonth',
  'Flexible'
];

/** The preset a proposal starts from when nothing else says when. */
export const DEFAULT_TIMEFRAME: Timeframe = { Preset: 'WithinTwoWeeks' };

/** One choice in a timeframe select: the value sent and what the member reads. */
export interface TimeframeOption {
  value: Timeframe;
  label: string;
}

/** A Holochain timestamp (microseconds) as a local date, in the app's one format. */
function microsToDate(micros: number): string {
  return formatDay(micros / 1000);
}

/** A timeframe as the member reads it: the preset's name, or its dates. */
export function timeframeLabel(t: Timeframe): string {
  if ('Preset' in t) return S.presets[t.Preset] ?? t.Preset;
  const end = microsToDate(t.Dates.end);
  if (t.Dates.start === null || t.Dates.start === undefined) return fill(S.by, { end });
  return fill(S.between, { start: microsToDate(t.Dates.start), end });
}

/** Two timeframes are the same when every field is, as the zome compares them. */
export function sameTimeframe(a: Timeframe, b: Timeframe): boolean {
  if ('Preset' in a || 'Preset' in b) {
    return 'Preset' in a && 'Preset' in b && a.Preset === b.Preset;
  }
  return (a.Dates.start ?? null) === (b.Dates.start ?? null) && a.Dates.end === b.Dates.end;
}

/** The preset choices, with `current` first when it is a window of dates of its own. */
export function timeframeOptions(current?: Timeframe | null): TimeframeOption[] {
  const presets: TimeframeOption[] = TIMEFRAME_PRESETS.map((preset) => ({
    value: { Preset: preset },
    label: S.presets[preset]
  }));
  return current && 'Dates' in current
    ? [{ value: current, label: timeframeLabel(current) }, ...presets]
    : presets;
}

/**
 * Whether a window has ended by `nowMicros` (a preset never has). A proposal does not
 * start from a listing's window that has ended: validation would refuse it.
 */
export function hasEnded(t: Timeframe, nowMicros: number): boolean {
  return 'Dates' in t && t.Dates.end <= nowMicros;
}
