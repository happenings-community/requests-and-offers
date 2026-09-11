import { describe, it, expect, beforeAll } from 'vitest';
import {
  setUnitRegistry,
  actionForKind,
  mapAgreementToHrea,
  mapCompletionToEvent,
  rnoAgreementRef
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
      delivery_timeframe: '2026-09-20',
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
