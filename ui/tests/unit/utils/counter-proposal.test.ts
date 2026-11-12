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
    quantity: { value: '3', unit: 'hours' }
  },
  reciprocal: {
    direction: 'Receive',
    resource_conforms_to: 'Hours (time bank)',
    resource_kind: 'Currency',
    quantity: { value: '3', unit: 'Hours (time bank)' }
  },
  medium: 'Hours (time bank)',
  terms: 'Saturday mornings',
  delivery_timeframe: 'Within 2 weeks',
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
    expect(normaliseQuantity('0')).toBeNull();
    expect(normaliseQuantity(null)).toBeNull();
    expect(normaliseQuantity(undefined)).toBeNull();
    expect(normaliseQuantity('2.5')).toBe('2.5');
  });
});

describe('normaliseQuantity, exactly', () => {
  it('reads every spelling of zero, and a blank, as no quantity', () => {
    for (const none of ['0', '0.0', '0.000000', '', '  ']) {
      expect(normaliseQuantity(none)).toBeNull();
    }
  });

  it('keeps what was typed, trimmed, with a decimal comma read as a dot', () => {
    expect(normaliseQuantity(' 1.50 ')).toBe('1.50');
    expect(normaliseQuantity('2,5')).toBe('2.5');
  });

  it('hands malformed input through for the problem check to name', () => {
    expect(normaliseQuantity('abc')).toBe('abc');
    expect(normaliseQuantity('-1')).toBe('-1');
  });
});

describe('changedFields, exactly', () => {
  it('sees "1.50" and "1.5" as the same amount', () => {
    const p = proposal({
      primary: { ...proposal().primary, quantity: { value: '1.5', unit: 'hours' } }
    });
    expect(changedFields(p, { ...startingEdits(p), primary: '1.50' })).toEqual([]);
    expect(changedFields(p, { ...startingEdits(p), primary: '1.51' })).toEqual(['primary']);
  });

  it('sees zero and blank as the same as no quantity, in every spelling', () => {
    const none = proposal({ primary: { ...proposal().primary, quantity: null } });
    for (const empty of ['0', '0.00', '', null, undefined]) {
      expect(changedFields(none, { ...startingEdits(none), primary: empty })).toEqual([]);
    }
  });

  it('does not lose a small difference a float would round away', () => {
    const p = proposal({
      primary: { ...proposal().primary, quantity: { value: '0.3', unit: 'hours' } }
    });
    expect(changedFields(p, { ...startingEdits(p), primary: '0.300000' })).toEqual([]);
    expect(changedFields(p, { ...startingEdits(p), primary: '0.300001' })).toEqual(['primary']);
  });
});

describe('counterProblem, malformed amounts', () => {
  const start = startingEdits(proposal());

  it.each(['1e3', 'NaN', 'Infinity', 'abc', '1.2.3', '.5', '5.', '01', '1.1234567', '9999999999'])(
    'refuses %j as not a plain number',
    (bad) => {
      expect(counterProblem(proposal(), { ...start, primary: bad })).toContain('must be a');
      expect(counterProblem(proposal(), { ...start, reciprocal: bad })).toContain('The amount');
    }
  );

  it('names a negative amount as negative, not as malformed', () => {
    expect(counterProblem(proposal(), { ...start, primary: '-0.5' })).toContain(
      "can't be negative"
    );
  });

  it('lets exact decimals through', () => {
    expect(counterProblem(proposal(), { ...start, primary: '2.50' })).toBeNull();
    expect(counterProblem(proposal(), { ...start, reciprocal: '0.000001' })).toBeNull();
  });
});

describe('changedFields', () => {
  it('sees nothing changed in the proposal as it stands', () => {
    expect(changedFields(proposal(), startingEdits(proposal()))).toEqual([]);
  });

  it('names each field that differs', () => {
    const edits = { primary: '4', reciprocal: '5', timeframe: 'Flexible' };
    expect(changedFields(proposal(), edits)).toEqual(['primary', 'reciprocal', 'timeframe']);
  });

  it('counts a change to or from zero, but not blank to zero', () => {
    expect(changedFields(proposal(), { ...startingEdits(proposal()), primary: '0' })).toEqual([
      'primary'
    ]);
    const none = proposal({ primary: { ...proposal().primary, quantity: null } });
    expect(changedFields(none, { ...startingEdits(none), primary: '0' })).toEqual([]);
    expect(changedFields(none, { ...startingEdits(none), primary: '2' })).toEqual(['primary']);
  });

  it('ignores the return figure on a gift, which cannot carry one', () => {
    const g = proposal({ reciprocal: gift });
    expect(changedFields(g, { ...startingEdits(g), reciprocal: '4' })).toEqual([]);
  });
});

describe('counterProblem', () => {
  it('asks for a change before anything can be sent', () => {
    expect(counterProblem(proposal(), startingEdits(proposal()))).toBe(NOTHING_CHANGED);
  });

  it('refuses negative hours and amounts in plain words', () => {
    const start = startingEdits(proposal());
    expect(counterProblem(proposal(), { ...start, primary: '-1' })).toContain("can't be negative");
    expect(counterProblem(proposal(), { ...start, reciprocal: '-2' })).toContain('The amount');
  });

  it('lets one changed field through', () => {
    expect(
      counterProblem(proposal(), { ...startingEdits(proposal()), timeframe: 'Flexible' })
    ).toBeNull();
  });
});

describe('buildCounter', () => {
  const countered = hash(10);

  it('names the proposal and carries only the quantities and timeframe', () => {
    const c = buildCounter(countered, proposal(), {
      primary: '5',
      reciprocal: '5',
      timeframe: 'Within a month'
    });
    expect(c).toEqual({
      agreement: countered,
      primary_quantity: { value: '5', unit: 'hours' },
      reciprocal_quantity: { value: '5', unit: 'Hours (time bank)' },
      delivery_timeframe: 'Within a month'
    });
  });

  it('sends zero or blank as no quantity, which validation accepts', () => {
    const c = buildCounter(countered, proposal(), {
      primary: '0',
      reciprocal: null,
      timeframe: 'Flexible'
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
      primary: '2',
      reciprocal: '10',
      timeframe: p.delivery_timeframe
    });
    expect(c.primary_quantity).toEqual({ value: '2', unit: 'hours' });
    expect(c.reciprocal_quantity).toEqual({ value: '10', unit: 'Hours (time bank)' });
  });

  it('never puts a quantity on a gift', () => {
    const p = proposal({ reciprocal: gift });
    expect(
      buildCounter(countered, p, { ...startingEdits(p), reciprocal: '4' }).reciprocal_quantity
    ).toBeNull();
  });
});

describe('timeframeOptions and describeQuantity', () => {
  it("keeps a proposal's own timeframe wording when it is not in the list", () => {
    expect(timeframeOptions('Next Tuesday')[0]).toBe('Next Tuesday');
    expect(timeframeOptions('Flexible')).not.toContain('Next Tuesday');
  });

  it('says what no quantity means', () => {
    expect(describeQuantity(null, 'hours')).toBe('No time estimate');
    expect(describeQuantity('0', 'amount')).toBe('No amount');
    expect(describeQuantity('1', 'hours')).toBe('1 hour');
    expect(describeQuantity('20', 'amount', 'GBP')).toBe('20 GBP');
  });
});
