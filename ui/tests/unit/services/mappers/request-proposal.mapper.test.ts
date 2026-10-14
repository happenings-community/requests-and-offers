import { describe, it, expect } from 'vitest';
import { Effect as E } from 'effect';
import {
  createProposalFromRequest,
  validateRequestMappingRequirements,
  createProposalReference,
  extractProposalIdFromReference,
  type RequestProposalMappingParams
} from '$lib/services/mappers/request-proposal.mapper';
import type { UIRequest } from '$lib/types/ui';
import type { Agent, ResourceSpecification } from '$lib/types/hrea';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockAgent = (id = 'agent-1', name = 'Test Requester'): Agent => ({
  id,
  name,
  note: 'ref:user:test-hash'
});

const createMockResourceSpec = (id: string, name: string): ResourceSpecification => ({
  id,
  name,
  note: `ref:serviceType:${id}`,
  classifiedAs: ['http://www.productontology.org/id/Service']
});

const createMockRequest = (overrides: Partial<UIRequest> = {}): UIRequest =>
  ({
    title: 'Test Request',
    description: 'A test request for services',
    service_type_hashes: [new Uint8Array([1, 2, 3])],
    medium_of_exchange_hashes: [new Uint8Array([4, 5, 6])],
    original_action_hash: new Uint8Array([7, 8, 9]),
    time_estimate_hours: 5,
    time_preference: 'Morning',
    time_zone: 'UTC',
    ...overrides
  }) as UIRequest;

// ============================================================================
// TESTS
// ============================================================================

describe('Request to Proposal Mapper', () => {
  describe('createProposalFromRequest', () => {
    it('should create proposal with correct name prefix', async () => {
      const params: RequestProposalMappingParams = {
        request: createMockRequest(),
        requesterAgent: createMockAgent(),
        serviceTypeResourceSpecs: [createMockResourceSpec('rs-1', 'Web Dev')],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromRequest(params));

      expect(result.proposal.name).toBe('Request: Test Request');
    });

    it('should create service intents with isReciprocal=false', async () => {
      const params: RequestProposalMappingParams = {
        request: createMockRequest(),
        requesterAgent: createMockAgent(),
        serviceTypeResourceSpecs: [
          createMockResourceSpec('rs-1', 'Web Dev'),
          createMockResourceSpec('rs-2', 'Design')
        ],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromRequest(params));

      expect(result.serviceIntents).toHaveLength(2);
      result.serviceIntents.forEach((intent) => {
        expect(intent.isReciprocal).toBe(false);
        expect(intent.action).toBe('work');
        expect(intent.receiver).toBe('agent-1');
      });
    });

    it('should create payment intent with isReciprocal=true', async () => {
      const params: RequestProposalMappingParams = {
        request: createMockRequest(),
        requesterAgent: createMockAgent(),
        serviceTypeResourceSpecs: [createMockResourceSpec('rs-1', 'Web Dev')],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromRequest(params));

      expect(result.paymentIntent.isReciprocal).toBe(true);
      expect(result.paymentIntent.action).toBe('transfer');
      expect(result.paymentIntent.provider).toBe('agent-1');
      expect(result.paymentIntent.resourceSpecifiedBy).toBe('rs-moe');
    });

    it('should combine all intents in allIntents array', async () => {
      const params: RequestProposalMappingParams = {
        request: createMockRequest(),
        requesterAgent: createMockAgent(),
        serviceTypeResourceSpecs: [
          createMockResourceSpec('rs-1', 'Web Dev'),
          createMockResourceSpec('rs-2', 'Design')
        ],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromRequest(params));

      expect(result.allIntents).toHaveLength(3); // 2 service + 1 payment
      expect(result.allIntents.filter((i) => !i.isReciprocal)).toHaveLength(2);
      expect(result.allIntents.filter((i) => i.isReciprocal)).toHaveLength(1);
    });

    it('should include time estimate in service intents when provided', async () => {
      const params: RequestProposalMappingParams = {
        request: createMockRequest({ time_estimate_hours: 10 }),
        requesterAgent: createMockAgent(),
        serviceTypeResourceSpecs: [createMockResourceSpec('rs-1', 'Web Dev')],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromRequest(params));

      expect(result.serviceIntents[0].resourceQuantity).toEqual({
        hasNumericalValue: 10,
        hasUnit: 'hour'
      });
    });

    it('should fail when title is empty', async () => {
      const params: RequestProposalMappingParams = {
        request: createMockRequest({ title: '' }),
        requesterAgent: createMockAgent(),
        serviceTypeResourceSpecs: [createMockResourceSpec('rs-1', 'Web Dev')],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      await expect(E.runPromise(createProposalFromRequest(params))).rejects.toThrow(
        'Request title is required'
      );
    });

    it('should fail when no service type resource specs provided', async () => {
      const params: RequestProposalMappingParams = {
        request: createMockRequest(),
        requesterAgent: createMockAgent(),
        serviceTypeResourceSpecs: [],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      await expect(E.runPromise(createProposalFromRequest(params))).rejects.toThrow(
        'At least one service type resource specification is required'
      );
    });

    it('should set requester as eligible on proposal', async () => {
      const params: RequestProposalMappingParams = {
        request: createMockRequest(),
        requesterAgent: createMockAgent(),
        serviceTypeResourceSpecs: [createMockResourceSpec('rs-1', 'Web Dev')],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromRequest(params));

      expect(result.proposal.eligible).toContain('agent-1');
    });
  });

  describe('validateRequestMappingRequirements', () => {
    it('should succeed with valid requirements', async () => {
      const result = await E.runPromise(
        validateRequestMappingRequirements(
          createMockRequest(),
          createMockAgent(),
          [createMockResourceSpec('rs-1', 'Web Dev')],
          createMockResourceSpec('rs-moe', 'USD')
        )
      );

      expect(result).toBeUndefined();
    });

    it('should fail when requester agent is null', async () => {
      await expect(
        E.runPromise(
          validateRequestMappingRequirements(
            createMockRequest(),
            null,
            [createMockResourceSpec('rs-1', 'Web Dev')],
            createMockResourceSpec('rs-moe', 'USD')
          )
        )
      ).rejects.toThrow('Requester agent not found');
    });

    it('should fail when medium of exchange spec is null', async () => {
      await expect(
        E.runPromise(
          validateRequestMappingRequirements(
            createMockRequest(),
            createMockAgent(),
            [createMockResourceSpec('rs-1', 'Web Dev')],
            null
          )
        )
      ).rejects.toThrow('Medium of exchange resource specification not found');
    });
  });

  describe('Proposal Reference Utilities', () => {
    it('should create proposal reference', () => {
      const ref = createProposalReference('proposal-abc-123');
      expect(ref).toBe('ref:proposal:proposal-abc-123');
    });

    it('should extract proposal ID from reference', () => {
      const id = extractProposalIdFromReference('ref:proposal:proposal-abc-123');
      expect(id).toBe('proposal-abc-123');
    });

    it('should return null for invalid reference format', () => {
      const id = extractProposalIdFromReference('invalid-reference');
      expect(id).toBeNull();
    });
  });
});
