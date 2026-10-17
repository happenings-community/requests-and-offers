import { describe, it, expect } from 'vitest';
import {
  chainsOf,
  groupByPerson,
  roundChanges,
  roundOutcome,
  waitingOnMe
} from '$lib/utils/exchange-chains';
import type { UIExchange } from '$lib/types/ui';

const hash = (n: number) => new Uint8Array([n, n, n, n]);
const me = hash(3);
const bob = hash(4);
const carol = hash(5);

/**
 * A round. `counters` names the round it answers. `to` is the counterparty:
 * the member whose move it is while the round is open.
 */
const round = (
  id: number,
  at: number,
  opts: {
    counters?: number;
    status?: UIExchange['status'];
    other?: Uint8Array;
    to?: Uint8Array;
    hours?: number | null;
    timeframe?: string;
  } = {}
): UIExchange => {
  const other = opts.other ?? bob;
  return {
    created_at: at,
    agreement_hash: hash(id),
    status: opts.status ?? 'Proposed',
    agreement: {
      listing: hash(1),
      listing_type: 'Offer',
      interest: hash(2),
      counterparty: opts.to ?? me,
      provider: other,
      receiver: me,
      primary: {
        direction: 'Provide',
        resource_conforms_to: 'Gardening',
        resource_kind: 'Service',
        quantity: opts.hours === null ? null : { value: opts.hours ?? 2, unit: 'hours' }
      },
      reciprocal: {
        direction: 'Receive',
        resource_conforms_to: '',
        resource_kind: 'Gift',
        quantity: null
      },
      medium: 'Free/Pay it Forward',
      terms: '',
      delivery_timeframe: opts.timeframe ?? 'Within 2 weeks',
      counters: opts.counters ? { agreement: hash(opts.counters), decline: hash(99) } : null
    }
  } as UIExchange;
};

const byTime = (e: UIExchange) => e.created_at;
const ids = (list: UIExchange[]) => list.map((e) => e.agreement_hash[0]);

describe('chainsOf (#333)', () => {
  it('follows counters from the first proposal to the latest round', () => {
    const chains = chainsOf([
      round(12, 300, { counters: 11 }),
      round(10, 100, { status: 'Declined' }),
      round(11, 200, { counters: 10, status: 'Declined' })
    ]);
    expect(chains).toHaveLength(1);
    expect(ids(chains[0].rounds)).toEqual([10, 11, 12]);
    expect(chains[0].latest.agreement_hash[0]).toBe(12);
  });

  it('keeps two negotiations on the same listing with the same person apart', () => {
    const chains = chainsOf([
      round(10, 100, { status: 'Declined' }),
      round(20, 110, { status: 'Declined' }),
      round(11, 200, { counters: 10 }),
      round(21, 210, { counters: 20 })
    ]);
    expect(chains.map((c) => ids(c.rounds))).toEqual([
      [10, 11],
      [20, 21]
    ]);
  });

  it('treats a single proposal as a chain of one', () => {
    const [c] = chainsOf([round(10, 100)]);
    expect(ids(c.rounds)).toEqual([10]);
  });

  it('starts a chain at a counter whose earlier round is not visible', () => {
    const [c] = chainsOf([round(11, 200, { counters: 10 })]);
    expect(ids(c.rounds)).toEqual([11]);
  });

  it('continues with the earlier answer if two ever answer one round', () => {
    const chains = chainsOf([
      round(10, 100, { status: 'Declined' }),
      round(12, 300, { counters: 10 }),
      round(11, 200, { counters: 10 })
    ]);
    expect(chains.map((c) => ids(c.rounds))).toEqual([[10, 11], [12]]);
  });
});

describe('waitingOnMe', () => {
  it('lists chains whose latest round awaits my move, newest first', () => {
    const chains = chainsOf([
      round(10, 100), // sent to me, open
      round(20, 300), // sent to me, open, newer
      round(30, 200, { to: bob }) // sent by me, waiting on Bob
    ]);
    expect(waitingOnMe(chains, me, byTime).map((c) => c.key)).toEqual([
      chains[1].key,
      chains[0].key
    ]);
  });
});

describe('groupByPerson', () => {
  it('groups chains by the other person, most recently active first', () => {
    const chains = chainsOf([
      round(10, 100, { other: bob }),
      round(20, 400, { other: carol, to: carol }),
      round(30, 300, { other: bob, to: bob })
    ]);
    const groups = groupByPerson(chains, me, byTime);
    expect(groups.map((g) => g.person[0])).toEqual([5, 4]);
    expect(groups[1].chains.map((c) => c.latest.agreement_hash[0])).toEqual([30, 10]);
  });

  it('marks a person whose group holds something waiting on me', () => {
    const chains = chainsOf([
      round(10, 100, { other: bob }),
      round(20, 200, { other: carol, to: carol })
    ]);
    const groups = groupByPerson(chains, me, byTime);
    expect(groups.find((g) => g.person[0] === 4)?.waitingOnMe).toBe(true);
    expect(groups.find((g) => g.person[0] === 5)?.waitingOnMe).toBe(false);
  });
});

describe('roundChanges', () => {
  it('names what changed from the round before', () => {
    const a = round(10, 100, { hours: 3 });
    const b = round(11, 200, { counters: 10, hours: 5, timeframe: 'Flexible' });
    expect(roundChanges(a, b)).toEqual([
      { field: 'primary', from: '3 hours', to: '5 hours' },
      { field: 'timeframe', from: 'Within 2 weeks', to: 'Flexible' }
    ]);
  });

  it('shows a quantity removed as none, and nothing for a first proposal', () => {
    const a = round(10, 100, { hours: 3 });
    const b = round(11, 200, { counters: 10, hours: null });
    expect(roundChanges(a, b)).toEqual([{ field: 'primary', from: '3 hours', to: 'none' }]);
    expect(roundChanges(undefined, a)).toEqual([]);
  });
});

describe('roundOutcome', () => {
  it('reads a round with a later round as countered, not declined', () => {
    expect(roundOutcome(round(10, 100, { status: 'Declined' }), true)).toBe('countered');
    expect(roundOutcome(round(10, 100, { status: 'Declined' }), false)).toBe('declined');
  });

  it('names every other ending', () => {
    expect(roundOutcome(round(1, 1), false)).toBe('open');
    expect(roundOutcome(round(1, 1, { status: 'Agreed' }), false)).toBe('accepted');
    expect(roundOutcome(round(1, 1, { status: 'OneSideDone' }), false)).toBe('accepted');
    expect(roundOutcome(round(1, 1, { status: 'Reviewed' }), false)).toBe('completed');
    expect(roundOutcome(round(1, 1, { status: 'Cancelled' }), false)).toBe('withdrawn');
    expect(
      roundOutcome(
        { ...round(1, 1, { status: 'Cancelled' }), response: { accepted: true } } as never,
        false
      )
    ).toBe('cancelled');
  });
});
