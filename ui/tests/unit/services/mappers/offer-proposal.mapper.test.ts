import { describe, it, expect } from 'vitest';
import { Effect as E } from 'effect';
import {
  createProposalFromOffer,
  validateOfferMappingRequirements,
  createProposalReference,
  extractProposalIdFromReference,
  type OfferProposalMappingParams
} from '$lib/services/mappers/offer-proposal.mapper';
import type { UIOffer } from '$lib/types/ui';
import type { Agent, ResourceSpecification } from '$lib/types/hrea';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const createMockAgent = (id = 'agent-1', name = 'Test Offerer'): Agent => ({
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

const createMockOffer = (overrides: Partial<UIOffer> = {}): UIOffer =>
  ({
    title: 'Test Offer',
    description: 'A test offer for services',
    service_type_hashes: [new Uint8Array([1, 2, 3])],
    medium_of_exchange_hashes: [new Uint8Array([4, 5, 6])],
    original_action_hash: new Uint8Array([7, 8, 9]),
    time_preference: 'Morning',
    time_zone: 'UTC',
    interaction_type: 'Virtual',
    ...overrides
  }) as UIOffer;

// ============================================================================
// TESTS
// ============================================================================

describe('Offer to Proposal Mapper', () => {
  describe('createProposalFromOffer', () => {
    it('should create proposal with correct name prefix', async () => {
      const params: OfferProposalMappingParams = {
        offer: createMockOffer(),
        offererAgent: createMockAgent(),
        serviceTypeResourceSpecs: [createMockResourceSpec('rs-1', 'Web Dev')],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromOffer(params));

      expect(result.proposal.name).toBe('Offer: Test Offer');
    });

    it('should create service intents with isReciprocal=false and provider=offerer', async () => {
      const params: OfferProposalMappingParams = {
        offer: createMockOffer(),
        offererAgent: createMockAgent(),
        serviceTypeResourceSpecs: [
          createMockResourceSpec('rs-1', 'Web Dev'),
          createMockResourceSpec('rs-2', 'Design')
        ],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromOffer(params));

      expect(result.serviceIntents).toHaveLength(2);
      result.serviceIntents.forEach((intent) => {
        expect(intent.isReciprocal).toBe(false);
        expect(intent.action).toBe('work');
        expect(intent.provider).toBe('agent-1'); // Offerer provides the service
      });
    });

    it('should create payment intent with isReciprocal=true and receiver=offerer', async () => {
      const params: OfferProposalMappingParams = {
        offer: createMockOffer(),
        offererAgent: createMockAgent(),
        serviceTypeResourceSpecs: [createMockResourceSpec('rs-1', 'Web Dev')],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromOffer(params));

      expect(result.paymentIntent.isReciprocal).toBe(true);
      expect(result.paymentIntent.action).toBe('transfer');
      expect(result.paymentIntent.receiver).toBe('agent-1'); // Offerer receives payment
      expect(result.paymentIntent.resourceSpecifiedBy).toBe('rs-moe');
    });

    it('should have opposite role assignment compared to request mapper', async () => {
      // Offer: provider=offerer (provides service), receiver=offerer (receives payment)
      // Request: receiver=requester (receives service), provider=requester (provides payment)
      const params: OfferProposalMappingParams = {
        offer: createMockOffer(),
        offererAgent: createMockAgent(),
        serviceTypeResourceSpecs: [createMockResourceSpec('rs-1', 'Web Dev')],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromOffer(params));

      // Service intent: offerer is the PROVIDER (they provide the service)
      expect(result.serviceIntents[0].provider).toBe('agent-1');
      expect(result.serviceIntents[0].receiver).toBeUndefined();

      // Payment intent: offerer is the RECEIVER (they receive payment)
      expect(result.paymentIntent.receiver).toBe('agent-1');
      expect(result.paymentIntent.provider).toBeUndefined();
    });

    it('should combine all intents in allIntents array', async () => {
      const params: OfferProposalMappingParams = {
        offer: createMockOffer(),
        offererAgent: createMockAgent(),
        serviceTypeResourceSpecs: [
          createMockResourceSpec('rs-1', 'Web Dev'),
          createMockResourceSpec('rs-2', 'Design')
        ],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromOffer(params));

      expect(result.allIntents).toHaveLength(3);
      expect(result.allIntents.filter((i) => !i.isReciprocal)).toHaveLength(2);
      expect(result.allIntents.filter((i) => i.isReciprocal)).toHaveLength(1);
    });

    it('should set empty eligible array for open proposals', async () => {
      const params: OfferProposalMappingParams = {
        offer: createMockOffer(),
        offererAgent: createMockAgent(),
        serviceTypeResourceSpecs: [createMockResourceSpec('rs-1', 'Web Dev')],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      const result = await E.runPromise(createProposalFromOffer(params));

      expect(result.proposal.eligible).toEqual([]); // Open to any potential receivers
    });

    it('should fail when title is empty', async () => {
      const params: OfferProposalMappingParams = {
        offer: createMockOffer({ title: '' }),
        offererAgent: createMockAgent(),
        serviceTypeResourceSpecs: [createMockResourceSpec('rs-1', 'Web Dev')],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      await expect(E.runPromise(createProposalFromOffer(params))).rejects.toThrow(
        'Offer title is required'
      );
    });

    it('should fail when no service type resource specs provided', async () => {
      const params: OfferProposalMappingParams = {
        offer: createMockOffer(),
        offererAgent: createMockAgent(),
        serviceTypeResourceSpecs: [],
        mediumOfExchangeResourceSpec: createMockResourceSpec('rs-moe', 'USD')
      };

      await expect(E.runPromise(createProposalFromOffer(params))).rejects.toThrow(
        'At least one service type resource specification is required'
      );
    });
  });

  describe('validateOfferMappingRequirements', () => {
    it('should succeed with valid requirements', async () => {
      const result = await E.runPromise(
        validateOfferMappingRequirements(
          createMockOffer(),
          createMockAgent(),
          [createMockResourceSpec('rs-1', 'Web Dev')],
          createMockResourceSpec('rs-moe', 'USD')
        )
      );

      expect(result).toBeUndefined();
    });

    it('should fail when offerer agent is null', async () => {
      await expect(
        E.runPromise(
          validateOfferMappingRequirements(
            createMockOffer(),
            null,
            [createMockResourceSpec('rs-1', 'Web Dev')],
            createMockResourceSpec('rs-moe', 'USD')
          )
        )
      ).rejects.toThrow('Offerer agent not found');
    });

    it('should fail when medium of exchange spec is null', async () => {
      await expect(
        E.runPromise(
          validateOfferMappingRequirements(
            createMockOffer(),
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
      const ref = createProposalReference('proposal-xyz-456');
      expect(ref).toBe('ref:proposal:proposal-xyz-456');
    });

    it('should extract proposal ID from reference', () => {
      const id = extractProposalIdFromReference('ref:proposal:proposal-xyz-456');
      expect(id).toBe('proposal-xyz-456');
    });

    it('should return null for invalid reference format', () => {
      const id = extractProposalIdFromReference('not-a-valid-ref');
      expect(id).toBeNull();
    });
  });
});
