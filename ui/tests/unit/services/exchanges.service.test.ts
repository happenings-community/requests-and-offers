import { expect, describe, it, beforeEach, vi } from 'vitest';
import { Effect as E, Layer, Either } from 'effect';
import { type Record, type ActionHash, ActionType } from '@holochain/client';
import {
  ExchangesServiceLive,
  ExchangesServiceTag,
  ExchangeError,
  type CreateExchangeProposalInput,
  type UpdateProposalStatusInput
} from '$lib/services/zomes/exchanges.service';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { createMockActionHash } from '../test-helpers';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a mock HolochainClientService with Effect-based methods
 */
const createMockHolochainClientService = () => ({
  appId: 'test-app',
  connectClientEffect: vi.fn(),
  getAppInfoEffect: vi.fn(),
  callZomeEffect: vi.fn(),
  callZomeRawEffect: vi.fn(),
  isConnectedEffect: vi.fn(() => E.succeed(true)),
  getClientEffect: vi.fn(() => E.succeed(null))
});

/**
 * Creates a mock Record with proper structure
 */
const createMockRecord = (overrides: any = {}): Record => ({
  signed_action: {
    hashed: {
      hash: createMockActionHash('test-hash'),
      content: {
        type: ActionType.Create,
        author: createMockActionHash('test-author'),
        timestamp: Date.now(),
        action_seq: 0,
        prev_action: createMockActionHash('prev-action'),
        entry_type: {
          App: {
            entry_index: 0,
            zome_index: 0,
            visibility: 'Public'
          }
        },
        entry_hash: createMockActionHash('entry-hash')
      }
    },
    signature: createMockActionHash('test-signature')
  },
  entry: overrides.entry || {
    type: 'ExchangeProposal',
    proposal_type: 'DirectResponse'
  }
});

/**
 * Helper to run service effects with proper layer setup
 */
const createServiceTestRunner = (
  mockClient: ReturnType<typeof createMockHolochainClientService>
) => {
  const testLayer = Layer.succeed(HolochainClientServiceTag, mockClient);

  return <T, E>(effect: E.Effect<T, E, ExchangesServiceTag>) =>
    E.runPromise(effect.pipe(E.provide(ExchangesServiceLive), E.provide(testLayer)));
};

// ============================================================================
// TESTS
// ============================================================================

describe('ExchangesService', () => {
  let mockHolochainClientService: ReturnType<typeof createMockHolochainClientService>;
  let mockRecord: Record;
  let mockActionHash: ActionHash;
  let runServiceEffect: ReturnType<typeof createServiceTestRunner>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockHolochainClientService = createMockHolochainClientService();
    mockActionHash = createMockActionHash('test-action-hash');
    mockRecord = createMockRecord({
      entry: {
        type: 'ExchangeProposal',
        proposal_type: 'DirectResponse',
        target_entity_hash: createMockActionHash('target'),
        service_details: 'Test services',
        terms: 'Test terms',
        exchange_medium: 'Test medium',
        exchange_value: '100',
        delivery_timeframe: 'Test timeframe',
        notes: 'Test notes',
        status: 'Pending',
        created_at: Date.now(),
        updated_at: Date.now()
      }
    });
    runServiceEffect = createServiceTestRunner(mockHolochainClientService);
  });

  describe('Exchange Proposal Operations', () => {
    it('should create exchange proposal successfully', async () => {
      const input: CreateExchangeProposalInput = {
        proposal_type: 'DirectResponse',
        target_entity_hash: createMockActionHash('target-entity'),
        service_details: 'Test exchange services',
        terms: 'Test terms and conditions',
        exchange_medium: 'Test medium',
        exchange_value: '100',
        delivery_timeframe: 'Test timeframe',
        notes: 'Test notes'
      };
      
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.createExchangeProposal(input);
        })
      );

      expect(result).toEqual(mockRecord);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'create_exchange_proposal',
        input
      );
    });

    it('should get exchange proposal successfully', async () => {
      const proposalHash = mockActionHash;
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getExchangeProposal(proposalHash);
        })
      );

      expect(result).toEqual(mockRecord);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_exchange_proposal',
        proposalHash
      );
    });

    it('should update proposal status successfully', async () => {
      const input: UpdateProposalStatusInput = {
        proposal_hash: mockActionHash,
        new_status: 'Accepted',
        reason: 'Proposal looks good'
      };
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockActionHash));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.updateProposalStatus(input);
        })
      );

      expect(result).toEqual(mockActionHash);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'update_proposal_status',
        input
      );
    });

    it('should get proposals for entity successfully', async () => {
      const entityHash = mockActionHash;
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getProposalsForEntity(entityHash);
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_proposals_for_entity',
        entityHash
      );
    });

    it('should get proposals by status successfully', async () => {
      const status = 'Pending';
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getProposalsByStatus(status);
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_proposals_by_status',
        status
      );
    });

    it('should get all proposals successfully', async () => {
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getAllProposals();
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_all_proposals',
        null
      );
    });

    it('should delete exchange proposal successfully', async () => {
      const proposalHash = mockActionHash;
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockActionHash));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.deleteExchangeProposal(proposalHash);
        })
      );

      expect(result).toEqual(mockActionHash);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'delete_exchange_proposal',
        proposalHash
      );
    });
  });

  describe('Agreement Operations', () => {
    it('should create agreement successfully', async () => {
      const input = {
        proposal_hash: mockActionHash,
        service_details: 'Agreed services',
        agreed_terms: 'Agreed terms',
        exchange_medium: 'Test medium',
        exchange_value: '100',
        delivery_timeframe: 'Test timeframe',
        additional_conditions: 'Additional conditions'
      };
      
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.createAgreement(input);
        })
      );

      expect(result).toEqual(mockRecord);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'create_agreement',
        input
      );
    });

    it('should get agreement successfully', async () => {
      const agreementHash = mockActionHash;
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getAgreement(agreementHash);
        })
      );

      expect(result).toEqual(mockRecord);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_agreement',
        agreementHash
      );
    });

    it('should update agreement status successfully', async () => {
      const input = {
        agreement_hash: mockActionHash,
        new_status: 'Active' as const
      };
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockActionHash));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.updateAgreementStatus(input);
        })
      );

      expect(result).toEqual(mockActionHash);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'update_agreement_status',
        input
      );
    });

    it('should validate completion successfully', async () => {
      const input = {
        agreement_hash: mockActionHash,
        validator_role: 'Provider' as const
      };
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockActionHash));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.validateCompletion(input);
        })
      );

      expect(result).toEqual(mockActionHash);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'validate_completion',
        input
      );
    });

    it('should get agreements by status successfully', async () => {
      const status = 'Active';
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getAgreementsByStatus(status);
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_agreements_by_status',
        status
      );
    });

    it('should get all agreements successfully', async () => {
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getAllAgreements();
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_all_agreements',
        null
      );
    });

    it('should get agreements for agent successfully', async () => {
      const agentPubKey = mockActionHash;
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getAgreementsForAgent(agentPubKey);
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_agreements_for_agent',
        agentPubKey
      );
    });
  });

  describe('Exchange Event Operations', () => {
    it('should create exchange event successfully', async () => {
      const input = {
        agreement_hash: mockActionHash,
        event_type: 'ProgressUpdate' as const,
        priority: 'Normal' as const,
        title: 'Progress Update',
        description: 'Work is progressing well',
        progress_percentage: 50,
        attachments: ['file1.txt'],
        is_public: true,
        metadata: { key1: 'value1' }
      };
      
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.createExchangeEvent(input);
        })
      );

      expect(result).toEqual(mockRecord);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'create_exchange_event',
        input
      );
    });

    it('should get events for agreement successfully', async () => {
      const agreementHash = mockActionHash;
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getEventsForAgreement(agreementHash);
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_events_for_agreement',
        agreementHash
      );
    });

    it('should get all exchange events successfully', async () => {
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getAllExchangeEvents();
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_all_exchange_events',
        null
      );
    });
  });

  describe('Exchange Review Operations', () => {
    it('should create mutual validation successfully', async () => {
      const input = {
        agreement_hash: mockActionHash,
        provider_validation: true,
        receiver_validation: true
      };
      
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.createMutualValidation(input);
        })
      );

      expect(result).toEqual(mockRecord);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'create_mutual_validation',
        input
      );
    });

    it('should create public review successfully', async () => {
      const input = {
        agreement_hash: mockActionHash,
        provider_validation: true,
        receiver_validation: true,
        completed_on_time: true,
        completed_as_agreed: true,
        rating: 5,
        comments: 'Excellent work!',
        reviewer_type: 'Receiver' as const
      };
      
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.createPublicReview(input);
        })
      );

      expect(result).toEqual(mockRecord);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'create_public_review',
        input
      );
    });

    it('should get reviews for agreement successfully', async () => {
      const agreementHash = mockActionHash;
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getReviewsForAgreement(agreementHash);
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_reviews_for_agreement',
        agreementHash
      );
    });

    it('should get all exchange reviews successfully', async () => {
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getAllExchangeReviews();
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_all_exchange_reviews',
        null
      );
    });
  });

  describe('Exchange Cancellation Operations', () => {
    it('should create mutual cancellation successfully', async () => {
      const input = {
        agreement_hash: mockActionHash,
        reason: 'MutualAgreement' as const,
        explanation: 'Both parties agreed to cancel',
        resolution_terms: 'No penalties'
      };
      
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.createMutualCancellation(input);
        })
      );

      expect(result).toEqual(mockRecord);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'create_mutual_cancellation',
        input
      );
    });

    it('should create unilateral cancellation successfully', async () => {
      const input = {
        agreement_hash: mockActionHash,
        reason: 'ProviderUnavailable' as const,
        initiated_by: 'Provider' as const,
        explanation: 'Provider became unavailable'
      };
      
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockRecord));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.createUnilateralCancellation(input);
        })
      );

      expect(result).toEqual(mockRecord);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'create_unilateral_cancellation',
        input
      );
    });

    it('should respond to cancellation successfully', async () => {
      const input = {
        cancellation_hash: mockActionHash,
        consent: true,
        notes: 'I agree to the cancellation'
      };
      
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockActionHash));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.respondToCancellation(input);
        })
      );

      expect(result).toEqual(mockActionHash);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'respond_to_cancellation',
        input
      );
    });

    it('should admin review cancellation successfully', async () => {
      const input = {
        cancellation_hash: mockActionHash,
        admin_notes: 'Cancellation approved',
        resolution_terms: 'Standard cancellation terms apply'
      };
      
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(mockActionHash));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.adminReviewCancellation(input);
        })
      );

      expect(result).toEqual(mockActionHash);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'admin_review_cancellation',
        input
      );
    });

    it('should get cancellations for agreement successfully', async () => {
      const agreementHash = mockActionHash;
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getCancellationsForAgreement(agreementHash);
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_cancellations_for_agreement',
        agreementHash
      );
    });

    it('should get all exchange cancellations successfully', async () => {
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed([mockRecord]));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getAllExchangeCancellations();
        })
      );

      expect(result).toEqual([mockRecord]);
      expect(mockHolochainClientService.callZomeRawEffect).toHaveBeenCalledWith(
        'exchanges',
        'get_all_exchange_cancellations',
        null
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle HolochainClientService errors', async () => {
      const input: CreateExchangeProposalInput = {
        proposal_type: 'DirectResponse',
        target_entity_hash: createMockActionHash('target-entity'),
        service_details: 'Test exchange services',
        terms: 'Test terms and conditions',
        exchange_medium: 'Test medium',
        exchange_value: '100',
        delivery_timeframe: 'Test timeframe',
        notes: 'Test notes'
      };
      
      const error = new Error('Holochain client error');
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.fail(error));

      const effect = E.gen(function* () {
        const exchangesService = yield* ExchangesServiceTag;
        return yield* exchangesService.createExchangeProposal(input);
      });

      const testLayer = Layer.succeed(HolochainClientServiceTag, mockHolochainClientService);
      const result = await E.runPromise(E.either(effect.pipe(E.provide(ExchangesServiceLive), E.provide(testLayer))));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(ExchangeError);
      }
    });

    it('should handle null responses gracefully', async () => {
      const proposalHash = mockActionHash;
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.succeed(null));

      const result = await runServiceEffect(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          return yield* exchangesService.getExchangeProposal(proposalHash);
        })
      );

      expect(result).toBe(null);
    });

    it('should handle ExchangeError instances correctly', async () => {
      const exchangeError = new ExchangeError({
        message: 'Exchange error',
        context: 'TEST_CONTEXT'
      });
      mockHolochainClientService.callZomeRawEffect.mockReturnValue(E.fail(exchangeError));

      const effect = E.gen(function* () {
        const exchangesService = yield* ExchangesServiceTag;
        return yield* exchangesService.getAllProposals();
      });

      const testLayer = Layer.succeed(HolochainClientServiceTag, mockHolochainClientService);
      const result = await E.runPromise(E.either(effect.pipe(E.provide(ExchangesServiceLive), E.provide(testLayer))));

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBe(exchangeError);
      }
    });
  });
});