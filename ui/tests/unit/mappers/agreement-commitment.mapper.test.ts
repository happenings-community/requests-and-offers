import { describe, it, expect, beforeAll } from 'vitest';
import {
  setUnitRegistry,
  setUnitLabels,
  unitLabelOf,
  unitRegistryFrom,
  actionForKind,
  mapAgreementToHrea,
  mapCompletionToEvent,
  rnoAgreementRef,
  agreementRefsFromHrea,
  commitmentProblem,
  exchangesToMirror
} from '$lib/services/mappers/agreement-commitment.mapper';
import type { UIExchange } from '$lib/types/ui';

// Structured measures require the unit registry the store fills after seeding.
beforeAll(() => {
  setUnitRegistry({ hours: 'unit-hours-id' });
});

const hash = (n: number) => new Uint8Array([n, n, n]) as unknown as UIExchange['agreement_hash'];

const exchange = (overrides: Partial<UIExchange['agreement']> = {}): UIExchange =>
  ({
    agreement_hash: hash(1),
    created_at: 1_700_000_000,
    status: 'accepted',
    agreement: {
      listing: hash(2),
      listing_type: 'Offer',
      interest: hash(3),
      counterparty: hash(4),
      provider: hash(5),
      receiver: hash(6),
      primary: { direction: 'Provide', resource_conforms_to: 'Bike repair', resource_kind: 'Service', quantity: { value: '2', unit: 'hours' } },
      reciprocal: { direction: 'Receive', resource_conforms_to: 'Time bank', resource_kind: 'Currency', quantity: { value: '2', unit: 'hours' } },
      medium: 'Time bank',
      terms: 'Bring the bike round on Saturday',
      delivery_timeframe: { Dates: { start: null, end: Date.UTC(2026, 8, 20) * 1000 } },
      ...overrides
    }
  }) as unknown as UIExchange;

const parties = { providerAgentId: 'agent-p', receiverAgentId: 'agent-r' };
const specs = { primarySpecId: 'spec-bike', reciprocalSpecId: 'spec-timebank' };

describe('actionForKind', () => {
  it('maps kinds to ValueFlows actions and refuses Tbd', () => {
    expect(actionForKind('Service')).toBe('work');
    expect(actionForKind('Currency')).toBe('transfer');
    expect(actionForKind('Gift')).toBe('transfer');
    expect(actionForKind('Tbd')).toBeNull();
  });
});

describe('mapAgreementToHrea', () => {
  it('produces one agreement and two commitments with parties swapped', () => {
    const m = mapAgreementToHrea(exchange(), parties, specs);
    expect(m).not.toBeNull();
    expect(m!.agreement.note).toBe(rnoAgreementRef(exchange()));
    expect(m!.primary.provider).toBe('agent-p');
    expect(m!.primary.receiver).toBe('agent-r');
    expect(m!.primary.resourceConformsTo).toBe('spec-bike');
    expect(m!.primary.resourceQuantity).toEqual({ hasNumericalValue: 2, hasUnit: 'unit-hours-id' });
    expect(m!.primary.agreedIn).toBe(rnoAgreementRef(exchange()));
    expect(m!.reciprocal!.provider).toBe('agent-r');
    expect(m!.reciprocal!.receiver).toBe('agent-p');
    expect(m!.reciprocal!.resourceConformsTo).toBe('spec-timebank');
  });

  it('writes the reciprocal commitment of a gift too, with no resource, framed by the medium (the DS model)', () => {
    const m = mapAgreementToHrea(
      exchange({ reciprocal: { direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift', quantity: null } }),
      parties,
      specs
    );
    expect(m!.reciprocal).not.toBeNull();
    expect(m!.reciprocal!.action).toBe('transfer');
    expect(m!.reciprocal!.provider).toBe('agent-r');
    expect(m!.reciprocal!.receiver).toBe('agent-p');
    expect(m!.reciprocal!.resourceConformsTo).toBeUndefined();
    expect(m!.reciprocal!.resourceQuantity).toBeUndefined();
    expect(m!.reciprocal!.note).toBe('Nothing owed, framed by Time bank');
  });

  it('writes the reciprocal commitment of a term to be discussed, with no resource', () => {
    const m = mapAgreementToHrea(
      exchange({ reciprocal: { direction: 'Receive', resource_conforms_to: '', resource_kind: 'Tbd', quantity: null } }),
      parties,
      specs
    );
    expect(m!.reciprocal!.action).toBe('transfer');
    expect(m!.reciprocal!.resourceConformsTo).toBeUndefined();
    expect(m!.reciprocal!.note).toBe('To be discussed, framed by Time bank');
  });

  it('refuses a Tbd primary', () => {
    const m = mapAgreementToHrea(
      exchange({ primary: { direction: 'Provide', resource_conforms_to: 'x', resource_kind: 'Tbd', quantity: null } }),
      parties,
      specs
    );
    expect(m).toBeNull();
  });

  describe('dates', () => {
    const accepted = Date.UTC(2026, 9, 1); // milliseconds
    const daysAfter = (n: number) => new Date(accepted + n * 24 * 60 * 60 * 1000).toISOString();

    it('counts a preset from the acceptance time, on both commitments', () => {
      for (const [preset, days] of [
        ['WithinAFewDays', 3],
        ['WithinTwoWeeks', 14],
        ['WithinAMonth', 30]
      ] as const) {
        const m = mapAgreementToHrea(
          exchange({ delivery_timeframe: { Preset: preset } }),
          parties,
          specs,
          accepted
        );
        expect(m!.primary.due).toBe(daysAfter(days));
        expect(m!.reciprocal!.due).toBe(daysAfter(days));
        expect(m!.primary.hasBeginning).toBeUndefined();
        expect(m!.primary.hasEnd).toBeUndefined();
      }
    });

    it("uses a window's end as due, converted from microseconds, with no beginning when the window has none", () => {
      const m = mapAgreementToHrea(exchange(), parties, specs, accepted);
      expect(m!.primary.due).toBe('2026-09-20T00:00:00.000Z');
      expect(m!.reciprocal!.due).toBe('2026-09-20T00:00:00.000Z');
      expect(m!.primary.hasBeginning).toBeUndefined();
      expect(m!.primary.hasEnd).toBeUndefined();
    });

    it('a window with a start also sets hasBeginning and hasEnd, on both commitments', () => {
      const m = mapAgreementToHrea(
        exchange({
          delivery_timeframe: {
            Dates: { start: Date.UTC(2026, 8, 10) * 1000, end: Date.UTC(2026, 8, 20) * 1000 }
          }
        }),
        parties,
        specs,
        accepted
      );
      for (const c of [m!.primary, m!.reciprocal!]) {
        expect(c.due).toBe('2026-09-20T00:00:00.000Z');
        expect(c.hasBeginning).toBe('2026-09-10T00:00:00.000Z');
        expect(c.hasEnd).toBe('2026-09-20T00:00:00.000Z');
      }
    });

    it('sets no dates for Flexible', () => {
      const m = mapAgreementToHrea(
        exchange({ delivery_timeframe: { Preset: 'Flexible' } }),
        parties,
        specs,
        accepted
      );
      for (const c of [m!.primary, m!.reciprocal!]) {
        expect(c.due).toBeUndefined();
        expect(c.hasBeginning).toBeUndefined();
        expect(c.hasEnd).toBeUndefined();
      }
    });

    it('sets the due date and leaves out a start that is not a date, rather than throwing', () => {
      // Validation bounds a window's end, not its start, so a hand-written agreement can
      // carry a start no Date can hold.
      const m = mapAgreementToHrea(
        exchange({
          delivery_timeframe: {
            Dates: { start: -9_223_372_036_854_776_000, end: Date.UTC(2026, 8, 20) * 1000 }
          }
        }),
        parties,
        specs,
        accepted
      );
      expect(m!.primary.due).toBe(new Date(Date.UTC(2026, 8, 20)).toISOString());
      expect(m!.primary.hasBeginning).toBeUndefined();
      expect(m!.primary.hasEnd).toBeUndefined();
    });

    it('leaves out a start hREA could not carry: before about 1685 its microseconds are not an exact integer', () => {
      const m = mapAgreementToHrea(
        exchange({
          delivery_timeframe: {
            Dates: { start: Date.UTC(1600, 0, 1) * 1000, end: Date.UTC(2026, 8, 20) * 1000 }
          }
        }),
        parties,
        specs,
        accepted
      );
      expect(m!.primary.due).toBe(new Date(Date.UTC(2026, 8, 20)).toISOString());
      expect(m!.primary.hasBeginning).toBeUndefined();
    });

    it('keeps the timeframe label in the note', () => {
      const m = mapAgreementToHrea(
        exchange({ delivery_timeframe: { Preset: 'WithinTwoWeeks' } }),
        parties,
        specs,
        accepted
      );
      expect(m!.primary.note).toContain('Timeframe: Within 2 weeks of agreeing');
    });
  });
});

describe('mapCompletionToEvent', () => {
  it('provider completion is the primary flow, receiver completion is the reciprocal', () => {
    const p = mapCompletionToEvent(exchange(), 'provider', parties, specs, 'hrea-agr', 1_700_000_100);
    const r = mapCompletionToEvent(exchange(), 'receiver', parties, specs, 'hrea-agr', 1_700_000_200);
    expect(p!.provider).toBe('agent-p');
    expect(p!.receiver).toBe('agent-r');
    expect(p!.action).toBe('work');
    expect(p!.realizationOf).toBe('hrea-agr');
    expect(r!.provider).toBe('agent-r');
    expect(r!.receiver).toBe('agent-p');
    expect(r!.action).toBe('transfer');
  });

  it('fulfills the Commitment of its side, and names none when the Commitment is unknown', () => {
    const p = mapCompletionToEvent(exchange(), 'provider', parties, specs, 'hrea-agr', 1, 'c-prim');
    expect(p!.fulfills).toEqual(['c-prim']);
    const unknown = mapCompletionToEvent(exchange(), 'provider', parties, specs, undefined, 1);
    expect(unknown!.fulfills).toBeUndefined();
  });

  it('carries a structured measure only for registered unit labels', () => {
    const known = mapCompletionToEvent(exchange(), 'provider', parties, specs, 'hrea-agr', 1);
    expect(known!.resourceQuantity).toEqual({ hasNumericalValue: 2, hasUnit: 'unit-hours-id' });
    const odd = exchange({
      primary: {
        direction: 'Provide',
        resource_conforms_to: 'Bike repair',
        resource_kind: 'Service',
        quantity: { value: '1', unit: 'furlongs' }
      }
    });
    expect(mapCompletionToEvent(odd, 'provider', parties, specs, 'hrea-agr', 1)!.resourceQuantity).toBeUndefined();
  });

  it('a receiver completing a gift writes its event, with no resource, fulfilling the reciprocal commitment', () => {
    const r = mapCompletionToEvent(
      exchange({ reciprocal: { direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift', quantity: null } }),
      'receiver',
      parties,
      specs,
      'hrea-agr',
      1,
      'c-recip'
    );
    expect(r).not.toBeNull();
    expect(r!.action).toBe('transfer');
    expect(r!.provider).toBe('agent-r');
    expect(r!.resourceConformsTo).toBeUndefined();
    expect(r!.resourceQuantity).toBeUndefined();
    expect(r!.fulfills).toEqual(['c-recip']);
  });
});

// U15a: agreementMappings lives in memory, so after a reload the store rebuilds
// an R&O agreement's hREA ids from hREA's own records.
describe('agreementRefsFromHrea', () => {
  const ref = rnoAgreementRef(exchange());
  const agreements = [
    { id: 'agr-other', revisionId: 'r0', note: 'someone-else' },
    { id: 'agr-1', revisionId: 'r1', note: ref }
  ];
  const commitment = (id: string, provider: string, receiver: string, clauseOf?: string) => ({
    id,
    revisionId: `${id}-rev`,
    action: 'work',
    provider,
    receiver,
    clauseOf
  });

  it('finds the agreement by its note and tells the two commitments apart by provider', () => {
    const commitments = [
      commitment('c-elsewhere', 'agent-p', 'agent-r', 'agr-other'),
      commitment('c-recip', 'agent-r', 'agent-p', 'agr-1'),
      commitment('c-prim', 'agent-p', 'agent-r', 'agr-1')
    ];
    expect(agreementRefsFromHrea(ref, parties, agreements, commitments)).toEqual({
      agreementId: 'agr-1',
      primaryCommitmentId: 'c-prim',
      primaryRevisionId: 'c-prim-rev',
      reciprocalCommitmentId: 'c-recip',
      reciprocalRevisionId: 'c-recip-rev'
    });
  });

  it('leaves the reciprocal out for a gift, which has one commitment', () => {
    const refs = agreementRefsFromHrea(ref, parties, agreements, [
      commitment('c-prim', 'agent-p', 'agent-r', 'agr-1')
    ]);
    expect(refs?.reciprocalCommitmentId).toBeUndefined();
    expect(refs?.primaryCommitmentId).toBe('c-prim');
  });

  it('returns null when hREA holds no agreement for this R&O hash, or no primary commitment', () => {
    expect(agreementRefsFromHrea('unknown', parties, agreements, [])).toBeNull();
    expect(
      agreementRefsFromHrea(ref, parties, agreements, [
        commitment('c-recip', 'agent-r', 'agent-p', 'agr-1')
      ])
    ).toBeNull();
  });

  it('of two Agreements carrying the same R&O hash, takes the one whose primary Commitment exists', () => {
    // A half-written earlier mirror: an Agreement whose Commitments were never written.
    const twice = [
      { id: 'agr-half', revisionId: 'rh', note: ref },
      { id: 'agr-1', revisionId: 'r1', note: ref }
    ];
    const refs = agreementRefsFromHrea(ref, parties, twice, [commitment('c-prim', 'agent-p', 'agent-r', 'agr-1')]);
    expect(refs?.agreementId).toBe('agr-1');
    expect(refs?.primaryCommitmentId).toBe('c-prim');
  });
});

describe('unitLabelOf', () => {
  it('names the Unit an id stands for, every copy of a label included, so a quantity never shows a raw hash', () => {
    setUnitLabels([
      { id: 'uhCkkV6bL-hours', label: 'hours' },
      { id: 'uhCkkA-hours', label: 'hours' },
      { id: 'uhCkkD-days', label: 'days' }
    ]);
    expect(unitLabelOf('uhCkkV6bL-hours')).toBe('hours');
    expect(unitLabelOf('uhCkkA-hours')).toBe('hours');
    expect(unitLabelOf('uhCkkD-days')).toBe('days');
  });

  it('answers undefined for an id it has not seen, and for none', () => {
    setUnitLabels([]);
    expect(unitLabelOf('uhCkk-unknown')).toBeUndefined();
    expect(unitLabelOf(undefined)).toBeUndefined();
  });
});

describe('unitRegistryFrom (#441)', () => {
  // Two members seeded at once: two Units per label, each member reading them in its own order.
  const units = [
    { id: 'uhCkkB:dna', label: 'hours', symbol: 'h' },
    { id: 'uhCkkA:dna', label: 'hours', symbol: 'h' },
    { id: 'uhCkkD:dna', label: 'days', symbol: 'd' },
    { id: 'uhCkkC:dna', label: 'days', symbol: 'd' },
    { id: 'uhCkkE:dna', label: 'each', symbol: 'ea' }
  ];

  it('resolves every label to the same Unit whatever order the Units arrive in', () => {
    expect(unitRegistryFrom(units)).toEqual(unitRegistryFrom([...units].reverse()));
  });

  it('picks the lowest id for a label held twice', () => {
    expect(unitRegistryFrom(units)).toEqual({
      hours: 'uhCkkA:dna',
      days: 'uhCkkC:dna',
      each: 'uhCkkE:dna'
    });
  });

  it('is empty for no Units', () => {
    expect(unitRegistryFrom([])).toEqual({});
  });
});

describe('commitmentProblem', () => {
  const good = {
    action: 'work',
    provider: 'agent-p',
    receiver: 'agent-r',
    resourceQuantity: { hasNumericalValue: 2, hasUnit: 'unit-hours' },
    due: '2026-09-20T00:00:00.000Z'
  };

  it('finds nothing wrong with what the mapper builds', () => {
    setUnitRegistry({ hours: 'unit-hours-id' });
    const at = Date.UTC(2026, 9, 1);
    const built = [
      mapAgreementToHrea(exchange(), parties, specs, at),
      mapAgreementToHrea(
        exchange({ delivery_timeframe: { Preset: 'WithinAMonth' } }),
        parties,
        specs,
        at
      ),
      mapAgreementToHrea(
        exchange({ delivery_timeframe: { Preset: 'Flexible' } }),
        parties,
        specs,
        at
      ),
      mapAgreementToHrea(
        exchange({
          reciprocal: {
            direction: 'Receive',
            resource_conforms_to: '',
            resource_kind: 'Gift',
            quantity: null
          }
        } as Partial<UIExchange['agreement']>),
        parties,
        specs,
        at
      )
    ];
    for (const m of built) {
      expect(commitmentProblem(m!.primary)).toBeNull();
      if (m!.reciprocal) expect(commitmentProblem(m!.reciprocal)).toBeNull();
    }
    expect(commitmentProblem(good)).toBeNull();
  });

  it('names what is wrong, in words, before hREA answers with bytes', () => {
    expect(commitmentProblem({ ...good, provider: '' })).toBe('the Commitment has no provider');
    expect(
      commitmentProblem({ ...good, resourceQuantity: { hasNumericalValue: NaN, hasUnit: 'u' } })
    ).toBe("the Commitment's quantity NaN is not a number above zero");
    expect(
      commitmentProblem({ ...good, resourceQuantity: { hasNumericalValue: 0, hasUnit: 'u' } })
    ).toBe("the Commitment's quantity 0 is not a number above zero");
    expect(
      commitmentProblem({ ...good, resourceQuantity: { hasNumericalValue: 2, hasUnit: '' } })
    ).toBe("the Commitment's quantity has no unit");
    expect(commitmentProblem({ ...good, due: 'Invalid Date' })).toBe(
      'the Commitment\'s due "Invalid Date" is not a date'
    );
    expect(commitmentProblem({ ...good, hasBeginning: '1600-01-01T00:00:00.000Z' })).toBe(
      'the Commitment\'s hasBeginning "1600-01-01T00:00:00.000Z" is out of range for hREA'
    );
  });
});

describe('exchangesToMirror', () => {
  const me = hash(4).toString(); // the fixture's counterparty: who accepts
  const acceptedEx = (overrides: Partial<UIExchange['agreement']> = {}) =>
    ({
      ...exchange(overrides),
      response: { agreement: hash(1), accepted: true, note: '', created_at: 1 }
    }) as unknown as UIExchange;

  it('keeps an accepted exchange whose acceptance this member wrote', () => {
    expect(exchangesToMirror([acceptedEx()], me, new Set())).toHaveLength(1);
  });

  it('leaves out one either side has marked done: its completion has no Agreement to fulfil', () => {
    const done = { created_at: 2 };
    expect(
      exchangesToMirror(
        [
          { ...acceptedEx(), provider_done: done } as unknown as UIExchange,
          { ...acceptedEx(), receiver_done: done } as unknown as UIExchange
        ],
        me,
        new Set()
      )
    ).toEqual([]);
  });

  it('keeps one cancelled since it was accepted: the caller finishes its Commitments', () => {
    const cancelled = {
      ...acceptedEx(),
      cancellation: { reason: 'moved away', created_at: 2 }
    } as unknown as UIExchange;
    expect(exchangesToMirror([cancelled], me, new Set())).toHaveLength(1);
  });

  it('leaves out one not yet accepted, or declined', () => {
    const declined = {
      ...exchange(),
      response: { agreement: hash(1), accepted: false, note: '', created_at: 1 }
    } as unknown as UIExchange;
    expect(exchangesToMirror([exchange(), declined], me, new Set())).toEqual([]);
  });

  it("leaves out one the other party accepted: the repair is the acceptor's", () => {
    expect(exchangesToMirror([acceptedEx()], hash(5).toString(), new Set())).toEqual([]);
  });

  it('leaves out one the mirror does not map, and one already known', () => {
    const tbd = acceptedEx({
      primary: {
        direction: 'Provide',
        resource_conforms_to: 'x',
        resource_kind: 'Tbd',
        quantity: null
      }
    } as Partial<UIExchange['agreement']>);
    expect(exchangesToMirror([tbd], me, new Set())).toEqual([]);
    expect(exchangesToMirror([acceptedEx()], me, new Set([rnoAgreementRef(acceptedEx())]))).toEqual(
      []
    );
  });
});
