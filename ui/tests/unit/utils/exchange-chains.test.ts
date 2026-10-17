import { describe, it, expect } from 'vitest';
import { chainsOf, groupChains, roundChanges, roundOutcome } from '$lib/utils/exchange-chains';
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

  it('starts a chain at a counter whose earlier round has not arrived, and says so', () => {
    const [c] = chainsOf([round(11, 200, { counters: 10 })]);
    expect(ids(c.rounds)).toEqual([11]);
    expect(c.missingEarlier).toBe(true);
  });

  it('does not flag a complete chain or a first proposal', () => {
    const [c] = chainsOf([
      round(10, 100, { status: 'Declined' }),
      round(11, 200, { counters: 10 })
    ]);
    expect(c.missingEarlier).toBe(false);
    expect(chainsOf([round(20, 100)])[0].missingEarlier).toBe(false);
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

describe('groupChains', () => {
  it('groups by the other person, most recently active first', () => {
    const chains = chainsOf([
      round(10, 100, { other: bob }),
      round(20, 400, { other: carol, to: carol }),
      round(30, 300, { other: bob, to: bob })
    ]);
    const groups = groupChains(chains, 'person', me, byTime);
    expect(groups.map((g) => counterOf(g))).toEqual([5, 4]);
    expect(groups[1].chains.map((c) => c.latest.agreement_hash[0])).toEqual([30, 10]);
  });

  it('marks a group holding something waiting on me', () => {
    const chains = chainsOf([
      round(10, 100, { other: bob }),
      round(20, 200, { other: carol, to: carol })
    ]);
    const groups = groupChains(chains, 'person', me, byTime);
    expect(groups.find((g) => counterOf(g) === 4)?.waitingOnMe).toBe(true);
    expect(groups.find((g) => counterOf(g) === 5)?.waitingOnMe).toBe(false);
  });

  it('groups by service, medium or listing', () => {
    const gardening = round(10, 100);
    const plumbing = {
      ...round(20, 200),
      agreement: {
        ...round(20, 200).agreement,
        listing: hash(8),
        medium: 'Pounds',
        primary: { ...round(20, 200).agreement.primary, resource_conforms_to: 'Plumbing' }
      }
    } as UIExchange;
    const chains = chainsOf([gardening, plumbing]);
    expect(groupChains(chains, 'service', me, byTime).map((g) => g.key)).toEqual([
      'Plumbing',
      'Gardening'
    ]);
    expect(groupChains(chains, 'medium', me, byTime).map((g) => g.key)).toEqual([
      'Pounds',
      'Free/Pay it Forward'
    ]);
    expect(groupChains(chains, 'listing', me, byTime)).toHaveLength(2);
  });

  it('keeps every round of a negotiation in one group', () => {
    const chains = chainsOf([
      round(10, 100, { status: 'Declined' }),
      round(11, 200, { counters: 10 })
    ]);
    for (const by of ['person', 'listing', 'service', 'medium'] as const) {
      const groups = groupChains(chains, by, me, byTime);
      expect(groups).toHaveLength(1);
      expect(groups[0].chains[0].rounds).toHaveLength(2);
    }
  });
});

/** The other person's id byte, for a person group. */
const counterOf = (g: { sample: { latest: UIExchange } }) => g.sample.latest.agreement.provider[0];

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
