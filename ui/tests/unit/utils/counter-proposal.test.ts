import { describe, it, expect } from 'vitest';
import {
  buildCounter,
  changedFields,
  counterProblem,
  describeQuantity,
  NOTHING_CHANGED,
  normaliseQuantity,
  reciprocalFigure,
  sameTimeframe,
  startingEdits,
  TIMEFRAME_PRESETS,
  timeframeLabel,
  timeframeOptions
} from '$lib/utils/counter-proposal';
import type { AgreementInDHT } from '$lib/types/holochain';

const hash = (n: number) => new Uint8Array([n, n, n, n]);

const proposal = (over: Partial<AgreementInDHT> = {}): AgreementInDHT => ({
  listing: hash(1),
  listing_type: 'Request',
  interest: hash(2),
  counterparty: hash(3),
  provider: hash(4),
  receiver: hash(3),
  primary: {
    direction: 'Provide',
    resource_conforms_to: 'Gardening',
    resource_kind: 'Service',
    quantity: { value: 3, unit: 'hours' }
  },
  reciprocal: {
    direction: 'Receive',
    resource_conforms_to: 'Hours (time bank)',
    resource_kind: 'Currency',
    quantity: { value: 3, unit: 'Hours (time bank)' }
  },
  medium: 'Hours (time bank)',
  terms: 'Saturday mornings',
  delivery_timeframe: { Preset: 'WithinTwoWeeks' },
  counters: null,
  ...over
});

const gift = {
  direction: 'Receive',
  resource_conforms_to: '',
  resource_kind: 'Gift',
  quantity: null
} as const;

describe('reciprocalFigure', () => {
  it('offers an amount for a currency, hours for a service, nothing for a gift', () => {
    expect(reciprocalFigure(proposal().reciprocal)).toBe('amount');
    expect(
      reciprocalFigure({ ...proposal().reciprocal, resource_kind: 'Service', quantity: null })
    ).toBe('hours');
    expect(reciprocalFigure(gift)).toBeNull();
    expect(reciprocalFigure({ ...gift, resource_kind: 'Tbd' })).toBeNull();
  });
});

describe('normaliseQuantity', () => {
  it('treats zero and blank as no quantity', () => {
    expect(normaliseQuantity(0)).toBeNull();
    expect(normaliseQuantity(null)).toBeNull();
    expect(normaliseQuantity(undefined)).toBeNull();
    expect(normaliseQuantity(2.5)).toBe(2.5);
  });
});

describe('changedFields', () => {
  it('sees nothing changed in the proposal as it stands', () => {
    expect(changedFields(proposal(), startingEdits(proposal()))).toEqual([]);
  });

  it('names each field that differs', () => {
    const edits = { primary: 4, reciprocal: 5, timeframe: { Preset: 'Flexible' } as const };
    expect(changedFields(proposal(), edits)).toEqual(['primary', 'reciprocal', 'timeframe']);
  });

  it('counts a change to or from zero, but not blank to zero', () => {
    expect(changedFields(proposal(), { ...startingEdits(proposal()), primary: 0 })).toEqual([
      'primary'
    ]);
    const none = proposal({ primary: { ...proposal().primary, quantity: null } });
    expect(changedFields(none, { ...startingEdits(none), primary: 0 })).toEqual([]);
    expect(changedFields(none, { ...startingEdits(none), primary: 2 })).toEqual(['primary']);
  });

  it('ignores the return figure on a gift, which cannot carry one', () => {
    const g = proposal({ reciprocal: gift });
    expect(changedFields(g, { ...startingEdits(g), reciprocal: 4 })).toEqual([]);
  });

  it('compares timeframes by value, not by identity', () => {
    const end = 1_800_000_000_000_000;
    const p = proposal({ delivery_timeframe: { Dates: { start: null, end } } });
    const same = { ...startingEdits(p), timeframe: { Dates: { start: null, end } } };
    expect(changedFields(p, same)).toEqual([]);
    const later = { ...startingEdits(p), timeframe: { Dates: { start: null, end: end + 1 } } };
    expect(changedFields(p, later)).toEqual(['timeframe']);
    expect(
      changedFields(proposal(), { ...startingEdits(proposal()), timeframe: { Preset: 'WithinTwoWeeks' } })
    ).toEqual([]);
  });
});

describe('counterProblem', () => {
  it('asks for a change before anything can be sent', () => {
    expect(counterProblem(proposal(), startingEdits(proposal()))).toBe(NOTHING_CHANGED);
  });

  it('refuses negative hours and amounts in plain words', () => {
    const start = startingEdits(proposal());
    expect(counterProblem(proposal(), { ...start, primary: -1 })).toContain("can't be negative");
    expect(counterProblem(proposal(), { ...start, reciprocal: -2 })).toContain('The amount');
  });

  it('lets one changed field through', () => {
    expect(
      counterProblem(proposal(), { ...startingEdits(proposal()), timeframe: { Preset: 'Flexible' } })
    ).toBeNull();
  });
});

describe('buildCounter', () => {
  const countered = hash(10);

  it('names the proposal and carries only the quantities and timeframe', () => {
    const c = buildCounter(countered, proposal(), {
      primary: 5,
      reciprocal: 5,
      timeframe: { Preset: 'WithinAMonth' }
    });
    expect(c).toEqual({
      agreement: countered,
      primary_quantity: { value: 5, unit: 'hours' },
      reciprocal_quantity: { value: 5, unit: 'Hours (time bank)' },
      delivery_timeframe: { Preset: 'WithinAMonth' }
    });
  });

  it('sends zero or blank as no quantity, which validation accepts', () => {
    const c = buildCounter(countered, proposal(), {
      primary: 0,
      reciprocal: null,
      timeframe: { Preset: 'Flexible' }
    });
    expect(c.primary_quantity).toBeNull();
    expect(c.reciprocal_quantity).toBeNull();
  });

  it('gives a new quantity a unit when the proposal had none', () => {
    const p = proposal({
      primary: { ...proposal().primary, quantity: null },
      reciprocal: { ...proposal().reciprocal, quantity: null }
    });
    const c = buildCounter(countered, p, {
      primary: 2,
      reciprocal: 10,
      timeframe: p.delivery_timeframe
    });
    expect(c.primary_quantity).toEqual({ value: 2, unit: 'hours' });
    expect(c.reciprocal_quantity).toEqual({ value: 10, unit: 'Hours (time bank)' });
  });

  it('never puts a quantity on a gift', () => {
    const p = proposal({ reciprocal: gift });
    expect(
      buildCounter(countered, p, { ...startingEdits(p), reciprocal: 4 }).reciprocal_quantity
    ).toBeNull();
  });
});

describe('timeframeOptions and describeQuantity', () => {
  it('offers the four presets in order, with their labels', () => {
    expect(timeframeOptions({ Preset: 'Flexible' })).toEqual(
      TIMEFRAME_PRESETS.map((p) => ({ value: { Preset: p.preset }, label: p.label }))
    );
    expect(TIMEFRAME_PRESETS.map((p) => p.label)).toEqual([
      'Within a few days',
      'Within 2 weeks',
      'Within a month',
      'Flexible'
    ]);
  });

  it("keeps a proposal's own dates as an extra first option", () => {
    const dates = { Dates: { start: null, end: Date.UTC(2026, 9, 30) * 1000 } };
    const options = timeframeOptions(dates);
    expect(options).toHaveLength(5);
    expect(options[0]).toEqual({ value: dates, label: timeframeLabel(dates) });
  });

  it('says what no quantity means', () => {
    expect(describeQuantity(null, 'hours')).toBe('No time estimate');
    expect(describeQuantity(0, 'amount')).toBe('No amount');
    expect(describeQuantity(1, 'hours')).toBe('1 hour');
    expect(describeQuantity(20, 'amount', 'GBP')).toBe('20 GBP');
  });
});

describe('timeframeLabel', () => {
  const day = (d: number) => Date.UTC(2026, 9, d) * 1000; // microseconds

  it("gives a preset its member-facing label", () => {
    expect(timeframeLabel({ Preset: 'WithinAFewDays' })).toBe('Within a few days');
    expect(timeframeLabel({ Preset: 'WithinTwoWeeks' })).toBe('Within 2 weeks');
    expect(timeframeLabel({ Preset: 'WithinAMonth' })).toBe('Within a month');
    expect(timeframeLabel({ Preset: 'Flexible' })).toBe('Flexible');
  });

  it('reads window dates as microseconds and formats them for the locale', () => {
    const date = (d: number) => new Date(Date.UTC(2026, 9, d)).toLocaleDateString('en-GB');
    expect(timeframeLabel({ Dates: { start: day(10), end: day(20) } }, 'en-GB')).toBe(
      `${date(10)} – ${date(20)}`
    );
    expect(timeframeLabel({ Dates: { start: null, end: day(20) } }, 'en-GB')).toBe(
      `by ${date(20)}`
    );
  });
});

describe('sameTimeframe', () => {
  it('matches presets by name and windows by both dates', () => {
    expect(sameTimeframe({ Preset: 'Flexible' }, { Preset: 'Flexible' })).toBe(true);
    expect(sameTimeframe({ Preset: 'Flexible' }, { Preset: 'WithinAMonth' })).toBe(false);
    expect(
      sameTimeframe({ Preset: 'Flexible' }, { Dates: { start: null, end: 1 } })
    ).toBe(false);
    expect(
      sameTimeframe({ Dates: { start: 1, end: 2 } }, { Dates: { start: null, end: 2 } })
    ).toBe(false);
    expect(sameTimeframe({ Dates: { start: 1, end: 2 } }, { Dates: { start: 1, end: 2 } })).toBe(
      true
    );
  });
});
