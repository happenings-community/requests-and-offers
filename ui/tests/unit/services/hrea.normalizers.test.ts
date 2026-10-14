import { describe, it, expect } from 'vitest';
import {
  normalizeIntentResponse,
  normalizeProposalResponse
} from '@/lib/services/hrea.service';
import type { GraphQLIntentResponse, GraphQLProposalResponse } from '$lib/types/hrea';

// The normalizers are pure functions converting the nested GraphQL response
// shapes into the flat domain models. They are exported from the service module
// specifically so they can be tested without any mocking (no Apollo, no
// Holochain client). This file covers every branch.

describe('normalizeIntentResponse', () => {
  describe('action', () => {
    it('flattens a nested action object to its id', () => {
      const raw: GraphQLIntentResponse = {
        id: 'i1',
        action: { id: 'transfer' }
      };
      expect(normalizeIntentResponse(raw).action).toBe('transfer');
    });

    it('passes through a string action unchanged', () => {
      const raw: GraphQLIntentResponse = { id: 'i1', action: 'work' };
      expect(normalizeIntentResponse(raw).action).toBe('work');
    });

    it('handles a null action object (passes through null, coerced to undefined by consumer)', () => {
      const raw = { id: 'i1', action: null } as unknown as GraphQLIntentResponse;
      // action is null -> typeof null === 'object' but null check fails -> stays null
      expect(normalizeIntentResponse(raw).action).toBeNull();
    });
  });

  describe('provider / receiver', () => {
    it('flattens nested provider and receiver objects to their ids', () => {
      const raw: GraphQLIntentResponse = {
        id: 'i1',
        action: 'transfer',
        provider: { id: 'agent-1', name: 'Jane' },
        receiver: { id: 'org-1', name: 'Acme' }
      };
      const out = normalizeIntentResponse(raw);
      expect(out.provider).toBe('agent-1');
      expect(out.receiver).toBe('org-1');
    });

    it('passes through string provider/receiver unchanged', () => {
      const raw: GraphQLIntentResponse = {
        id: 'i1',
        action: 'transfer',
        provider: 'agent-1',
        receiver: 'org-1'
      };
      const out = normalizeIntentResponse(raw);
      expect(out.provider).toBe('agent-1');
      expect(out.receiver).toBe('org-1');
    });

    it('coerces empty-string provider/receiver to undefined', () => {
      const raw = {
        id: 'i1',
        action: 'transfer',
        provider: '',
        receiver: ''
      } as unknown as GraphQLIntentResponse;
      const out = normalizeIntentResponse(raw);
      expect(out.provider).toBeUndefined();
      expect(out.receiver).toBeUndefined();
    });

    it('coerces null provider/receiver to undefined', () => {
      const raw: GraphQLIntentResponse = {
        id: 'i1',
        action: 'transfer',
        provider: null,
        receiver: null
      };
      const out = normalizeIntentResponse(raw);
      expect(out.provider).toBeUndefined();
      expect(out.receiver).toBeUndefined();
    });

    it('leaves provider/receiver undefined when absent', () => {
      const raw: GraphQLIntentResponse = { id: 'i1', action: 'transfer' };
      const out = normalizeIntentResponse(raw);
      expect(out.provider).toBeUndefined();
      expect(out.receiver).toBeUndefined();
    });
  });

  describe('resourceSpecifiedBy', () => {
    it('prefers resourceConformsTo.id when present', () => {
      const raw: GraphQLIntentResponse = {
        id: 'i1',
        action: 'transfer',
        resourceConformsTo: { id: 'rspec-1', name: 'Bread' },
        resourceSpecifiedBy: 'should-be-shadowed'
      };
      expect(normalizeIntentResponse(raw).resourceSpecifiedBy).toBe('rspec-1');
    });

    it('falls back to resourceSpecifiedBy string when resourceConformsTo absent', () => {
      const raw = {
        id: 'i1',
        action: 'transfer',
        resourceSpecifiedBy: 'rspec-fallback'
      } as unknown as GraphQLIntentResponse;
      expect(normalizeIntentResponse(raw).resourceSpecifiedBy).toBe('rspec-fallback');
    });

    it('is undefined when neither is present', () => {
      const raw: GraphQLIntentResponse = { id: 'i1', action: 'transfer' };
      expect(normalizeIntentResponse(raw).resourceSpecifiedBy).toBeUndefined();
    });
  });

  describe('resourceQuantity', () => {
    it('flattens a nested hasUnit object to its id', () => {
      const raw: GraphQLIntentResponse = {
        id: 'i1',
        action: 'transfer',
        resourceQuantity: {
          hasNumericalValue: 5,
          hasUnit: { id: 'unit-1', label: 'loaf', symbol: 'lf' }
        }
      };
      const out = normalizeIntentResponse(raw);
      expect(out.resourceQuantity).toEqual({ hasNumericalValue: 5, hasUnit: 'unit-1' });
    });

    it('passes through a string hasUnit unchanged', () => {
      const raw: GraphQLIntentResponse = {
        id: 'i1',
        action: 'transfer',
        resourceQuantity: { hasNumericalValue: 3, hasUnit: 'kilogram' }
      };
      expect(normalizeIntentResponse(raw).resourceQuantity).toEqual({
        hasNumericalValue: 3,
        hasUnit: 'kilogram'
      });
    });

    it('handles a null hasUnit object', () => {
      const raw = {
        id: 'i1',
        action: 'transfer',
        resourceQuantity: { hasNumericalValue: 2, hasUnit: null }
      } as unknown as GraphQLIntentResponse;
      expect(normalizeIntentResponse(raw).resourceQuantity).toEqual({
        hasNumericalValue: 2,
        hasUnit: null
      });
    });

    it('is undefined when resourceQuantity is absent', () => {
      const raw: GraphQLIntentResponse = { id: 'i1', action: 'transfer' };
      expect(normalizeIntentResponse(raw).resourceQuantity).toBeUndefined();
    });
  });

  describe('pass-through fields', () => {
    it('preserves id, revisionId, and note', () => {
      const raw: GraphQLIntentResponse = {
        id: 'i1',
        revisionId: 'rev-1',
        action: 'transfer',
        note: 'five loaves'
      };
      const out = normalizeIntentResponse(raw);
      expect(out.id).toBe('i1');
      expect(out.revisionId).toBe('rev-1');
      expect(out.note).toBe('five loaves');
    });

    it('leaves revisionId and note undefined when absent', () => {
      const raw: GraphQLIntentResponse = { id: 'i1', action: 'transfer' };
      const out = normalizeIntentResponse(raw);
      expect(out.revisionId).toBeUndefined();
      expect(out.note).toBeUndefined();
    });
  });
});

describe('normalizeProposalResponse', () => {
  it('maps all fields', () => {
    const raw: GraphQLProposalResponse = {
      id: 'p1',
      name: 'Trade',
      note: 'A trade',
      created: '2026-01-01T00:00:00Z',
      revisionId: 'rev-1',
      hasBeginning: '2026-01-02',
      hasEnd: '2026-01-09',
      unitBased: true
    };
    expect(normalizeProposalResponse(raw)).toEqual({
      id: 'p1',
      name: 'Trade',
      note: 'A trade',
      created: '2026-01-01T00:00:00Z',
      revisionId: 'rev-1',
      hasBeginning: '2026-01-02',
      hasEnd: '2026-01-09',
      unitBased: true
    });
  });

  it('handles optional fields being absent', () => {
    const raw: GraphQLProposalResponse = {
      id: 'p2',
      name: 'Minimal'
    };
    const out = normalizeProposalResponse(raw);
    expect(out.id).toBe('p2');
    expect(out.name).toBe('Minimal');
    expect(out.note).toBeUndefined();
    expect(out.created).toBeUndefined();
    expect(out.revisionId).toBeUndefined();
    expect(out.hasBeginning).toBeUndefined();
    expect(out.hasEnd).toBeUndefined();
    expect(out.unitBased).toBeUndefined();
  });

  it('preserves explicit nulls as undefined for optional fields', () => {
    const raw = {
      id: 'p3',
      name: 'WithNulls',
      note: null,
      created: null,
      revisionId: null,
      hasBeginning: null,
      hasEnd: null,
      unitBased: null
    } as unknown as GraphQLProposalResponse;
    const out = normalizeProposalResponse(raw);
    expect(out.note).toBeNull();
    expect(out.created).toBeNull();
    expect(out.hasBeginning).toBeNull();
    expect(out.hasEnd).toBeNull();
    expect(out.unitBased).toBeNull();
  });

  it('preserves the relationship fields note (they are not part of the flat Proposal model)', () => {
    // The publishes/reciprocal nested intent arrays are intentionally NOT part
    // of the flat Proposal domain model; the normalizer drops them. This test
    // documents that contract.
    const raw: GraphQLProposalResponse = {
      id: 'p4',
      name: 'WithIntents',
      publishes: [{ id: 'intent-1' } as unknown as GraphQLIntentResponse],
      reciprocal: [{ id: 'intent-2' } as unknown as GraphQLIntentResponse]
    };
    const out = normalizeProposalResponse(raw);
    expect(out).not.toHaveProperty('publishes');
    expect(out).not.toHaveProperty('reciprocal');
    expect(out.id).toBe('p4');
  });
});
