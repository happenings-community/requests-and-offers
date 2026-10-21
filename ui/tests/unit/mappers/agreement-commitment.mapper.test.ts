import { describe, it, expect, beforeAll, vi } from 'vitest';
import { Effect as E, Exit } from 'effect';
import {
  setUnitRegistry,
  actionForKind,
  carriesDates,
  mapAgreementToHrea,
  mapCompletionToEvent,
  rnoAgreementRef,
  withoutDates,
  isRecognisedRefusal,
  writeCommitment
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
      primary: { direction: 'Provide', resource_conforms_to: 'Bike repair', resource_kind: 'Service', quantity: { value: 2, unit: 'hours' } },
      reciprocal: { direction: 'Receive', resource_conforms_to: 'Time bank', resource_kind: 'Currency', quantity: { value: 2, unit: 'hours' } },
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

  it('has no reciprocal commitment for a gift', () => {
    const m = mapAgreementToHrea(
      exchange({ reciprocal: { direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift', quantity: null } }),
      parties,
      specs
    );
    expect(m!.reciprocal).toBeNull();
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
        expect(carriesDates(c)).toBe(false);
      }
    });

    it('withoutDates strips exactly the three dates, for the write made when hREA refuses them', () => {
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
      expect(carriesDates(m!.primary)).toBe(true);
      const bare = withoutDates(m!.primary);
      expect(carriesDates(bare)).toBe(false);
      expect(bare).toEqual({
        ...m!.primary,
        due: undefined,
        hasBeginning: undefined,
        hasEnd: undefined
      });
      expect(Object.keys(bare)).not.toContain('due');
    });

    it('keeps the timeframe label in the note', () => {
      const m = mapAgreementToHrea(
        exchange({ delivery_timeframe: { Preset: 'WithinTwoWeeks' } }),
        parties,
        specs,
        accepted
      );
      expect(m!.primary.note).toContain('Timeframe: Within 2 weeks');
    });
  });
});

describe('writeCommitment', () => {
  // Error shapes as they reach the store: HreaError wrapping Apollo's error,
  // whose graphQLErrors keep the Holochain client's error as originalError.
  const wrapped = (name: string, message: string) => ({
    _tag: 'HreaError',
    name: 'HreaError',
    message,
    cause: {
      name: 'ApolloError',
      message,
      graphQLErrors: [{ message, originalError: { name, message } }]
    }
  });
  const refusal = wrapped('ribosome_error', 'Deserialize([...]) at rea_commitment.rs');
  const timeout = wrapped('Error', 'Request timed out in 60000 ms: call_zome');
  const dated = { action: 'work', provider: 'p', receiver: 'r', due: '2026-09-20T00:00:00.000Z' };
  const written = { id: 'c1', revisionId: 'r1', action: 'work', provider: 'p', receiver: 'r' };

  it('recognises a refusal only by the two conductor error names a bad input produces', () => {
    expect(isRecognisedRefusal(refusal)).toBe(true);
    expect(isRecognisedRefusal(wrapped('deserialization', 'bad input'))).toBe(true);
    expect(isRecognisedRefusal(wrapped('zome_call_unauthorized', 'no grant'))).toBe(false);
    expect(isRecognisedRefusal(wrapped('zome_call_authentication_failed', 'bad signature'))).toBe(false);
    expect(isRecognisedRefusal(timeout)).toBe(false);
    expect(isRecognisedRefusal(wrapped('internal_error', 'conductor'))).toBe(false);
    expect(isRecognisedRefusal(new Error('Request timed out in 60000 ms: x'))).toBe(false);
    expect(isRecognisedRefusal(null)).toBe(false);
    expect(isRecognisedRefusal('ribosome_error')).toBe(false);
  });

  it('on a recognised refusal writes once more without the dates', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const create = vi
      .fn()
      .mockReturnValueOnce(E.fail(refusal))
      .mockReturnValueOnce(E.succeed(written));
    const out = await E.runPromise(writeCommitment(create, dated, 'ref'));
    expect(out).toBe(written);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0]).toBe(dated);
    expect(create.mock.calls[1][0]).toEqual({ action: 'work', provider: 'p', receiver: 'r' });
  });

  it('on a timeout does not retry, since the first write may have landed', async () => {
    const create = vi.fn().mockReturnValue(E.fail(timeout));
    const exit = await E.runPromiseExit(writeCommitment(create, dated, 'ref'));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('on an unauthorized call does not retry, since dates are not the cause', async () => {
    const create = vi.fn().mockReturnValue(E.fail(wrapped('zome_call_unauthorized', 'no grant')));
    const exit = await E.runPromiseExit(writeCommitment(create, dated, 'ref'));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('on any other error does not retry either', async () => {
    const create = vi.fn().mockReturnValue(E.fail(wrapped('internal_error', 'conductor')));
    const exit = await E.runPromiseExit(writeCommitment(create, dated, 'ref'));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('writes an input without dates once, even when refused', async () => {
    const create = vi.fn().mockReturnValue(E.fail(refusal));
    const exit = await E.runPromiseExit(writeCommitment(create, withoutDates(dated), 'ref'));
    expect(Exit.isFailure(exit)).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
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

  it('carries a structured measure only for registered unit labels', () => {
    const known = mapCompletionToEvent(exchange(), 'provider', parties, specs, 'hrea-agr', 1);
    expect(known!.resourceQuantity).toEqual({ hasNumericalValue: 2, hasUnit: 'unit-hours-id' });
    const odd = exchange({
      primary: {
        direction: 'Provide',
        resource_conforms_to: 'Bike repair',
        resource_kind: 'Service',
        quantity: { value: 1, unit: 'furlongs' }
      }
    });
    expect(mapCompletionToEvent(odd, 'provider', parties, specs, 'hrea-agr', 1)!.resourceQuantity).toBeUndefined();
  });

  it('a receiver completing a gift writes no event', () => {
    const r = mapCompletionToEvent(
      exchange({ reciprocal: { direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift', quantity: null } }),
      'receiver',
      parties,
      specs,
      'hrea-agr',
      1
    );
    expect(r).toBeNull();
  });
});
