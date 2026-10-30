import { describe, it, expect } from 'vitest';
import {
  buildCounter,
  changedFields,
  counterProblem,
  describeQuantity,
  NOTHING_CHANGED,
  normaliseQuantity,
  reciprocalFigure,
  startingEdits,
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
  delivery_timeframe: 'Within 2 weeks',
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
    const edits = { primary: 4, reciprocal: 5, timeframe: 'Flexible' };
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
      counterProblem(proposal(), { ...startingEdits(proposal()), timeframe: 'Flexible' })
    ).toBeNull();
  });
});

describe('buildCounter', () => {
  it('copies the proposal and applies only the quantities and timeframe', () => {
    const p = proposal();
    const c = buildCounter(p, { primary: 5, reciprocal: 5, timeframe: 'Within a month' });
    expect(c).toEqual({
      listing: p.listing,
      listing_type: p.listing_type,
      interest: p.interest,
      primary: { ...p.primary, quantity: { value: 5, unit: 'hours' } },
      reciprocal: { ...p.reciprocal, quantity: { value: 5, unit: 'Hours (time bank)' } },
      medium: p.medium,
      terms: 'Saturday mornings',
      delivery_timeframe: 'Within a month'
    });
  });

  it('stores zero or blank as no quantity, which validation accepts', () => {
    const c = buildCounter(proposal(), { primary: 0, reciprocal: null, timeframe: 'Flexible' });
    expect(c.primary.quantity).toBeNull();
    expect(c.reciprocal.quantity).toBeNull();
  });

  it('gives a new quantity a unit when the proposal had none', () => {
    const p = proposal({
      primary: { ...proposal().primary, quantity: null },
      reciprocal: { ...proposal().reciprocal, quantity: null }
    });
    const c = buildCounter(p, { primary: 2, reciprocal: 10, timeframe: p.delivery_timeframe });
    expect(c.primary.quantity).toEqual({ value: 2, unit: 'hours' });
    expect(c.reciprocal.quantity).toEqual({ value: 10, unit: 'Hours (time bank)' });
  });

  it('never puts a quantity on a gift', () => {
    const p = proposal({ reciprocal: gift });
    expect(buildCounter(p, { ...startingEdits(p), reciprocal: 4 }).reciprocal).toEqual(gift);
  });
});

describe('timeframeOptions and describeQuantity', () => {
  it("keeps a proposal's own timeframe wording when it is not in the list", () => {
    expect(timeframeOptions('Next Tuesday')[0]).toBe('Next Tuesday');
    expect(timeframeOptions('Flexible')).not.toContain('Next Tuesday');
  });

  it('says what no quantity means', () => {
    expect(describeQuantity(null, 'hours')).toBe('No time estimate');
    expect(describeQuantity(0, 'amount')).toBe('No amount');
    expect(describeQuantity(1, 'hours')).toBe('1 hour');
    expect(describeQuantity(20, 'amount', 'GBP')).toBe('20 GBP');
  });
});
