import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import { Effect as E } from 'effect';
import type { ActionHash, Record } from '@holochain/client';
import {
  createExchangesStore,
  type ExchangesStore
} from '$lib/stores/exchanges.store.svelte';
import {
  ExchangesServiceTag,
  type ExchangesService,
  ExchangeError,
  type CreateExchangeProposalInput,
  type UpdateProposalStatusInput,
  type CreateAgreementInput,
  type UpdateAgreementStatusInput,
  type ValidateCompletionInput,
  type CreateExchangeEventInput,
  type CreateMutualValidationInput,
  type CreatePublicReviewInput,
  type CreateMutualCancellationInput,
  type CreateUnilateralCancellationInput,
  type RespondToCancellationInput,
  type AdminReviewCancellationInput
} from '$lib/services/zomes/exchanges.service';
import { createMockActionHash } from '../test-helpers';
import { encode } from '@msgpack/msgpack';
import { ActionType } from '@holochain/client';
import { runEffect } from '$lib/utils/effect';
import { CacheServiceLive } from '$lib/utils/cache.svelte';

// ============================================================================
// TEST UTILITIES
// ============================================================================

/**
 * Creates a mock Record with proper MessagePack structure for exchanges
 */
const createMockExchangeRecord = (entryType: string, overrides: any = {}): Record => {
  const entry = {
    type: entryType,
    proposal_type: 'DirectResponse',
    service_details: 'Test services',
    terms: 'Test terms',
    exchange_medium: 'Test medium',
    exchange_value: '100',
    delivery_timeframe: 'Test timeframe',
    notes: 'Test notes',
    status: 'Pending',
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides.entry
  };

  return {
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
    entry: {
      Present: {
        entry_type: 'App',
        entry: encode(entry)
      }
    }
  };
};

describe('ExchangesStore', () => {
  let store: ExchangesStore;
  let mockExchangesService: ExchangesService;
  let mockRecord: Record;
  let mockActionHash: ActionHash;

  // Helper function to create a mock service
  const createMockService = (overrides: Partial<ExchangesService> = {}): ExchangesService => {
    const defaultService = {
      // Exchange Proposal methods
      createExchangeProposal: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      getExchangeProposal: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      updateProposalStatus: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
      getProposalsForEntity: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      getProposalsByStatus: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      getAllProposals: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      deleteExchangeProposal: vi.fn().mockReturnValue(E.succeed(mockActionHash)),

      // Agreement methods
      createAgreement: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      getAgreement: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      updateAgreementStatus: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
      validateCompletion: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
      getAgreementsByStatus: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      getAllAgreements: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      getAgreementsForAgent: vi.fn().mockReturnValue(E.succeed([mockRecord])),

      // Exchange Event methods
      createExchangeEvent: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      getEventsForAgreement: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      getAllExchangeEvents: vi.fn().mockReturnValue(E.succeed([mockRecord])),

      // Exchange Review methods
      createMutualValidation: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      createPublicReview: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      getReviewsForAgreement: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      getAllExchangeReviews: vi.fn().mockReturnValue(E.succeed([mockRecord])),

      // Exchange Cancellation methods
      createMutualCancellation: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      createUnilateralCancellation: vi.fn().mockReturnValue(E.succeed(mockRecord)),
      respondToCancellation: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
      adminReviewCancellation: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
      getCancellationsForAgreement: vi.fn().mockReturnValue(E.succeed([mockRecord])),
      getAllExchangeCancellations: vi.fn().mockReturnValue(E.succeed([mockRecord]))
    } as ExchangesService;
    return { ...defaultService, ...overrides } as ExchangesService;
  };

  // Helper function to create a store with custom service
  const createStoreWithService = async (
    service: ExchangesService
  ): Promise<ExchangesStore> => {
    return await E.runPromise(
      createExchangesStore().pipe(
        E.provideService(ExchangesServiceTag, service),
        E.provide(CacheServiceLive)
      )
    );
  };

  beforeEach(async () => {
    mockRecord = createMockExchangeRecord('ExchangeProposal');
    mockActionHash = createMockActionHash('test-action-hash');

    // Create default mock service
    mockExchangesService = createMockService();

    // Create store instance with mocked service
    store = await createStoreWithService(mockExchangesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      expect(store.exchangeProposals).toEqual([]);
      expect(store.agreements).toEqual([]);
      expect(store.exchangeEvents).toEqual([]);
      expect(store.exchangeReviews).toEqual([]);
      expect(store.exchangeCancellations).toEqual([]);
      expect(store.pendingProposals).toEqual([]);
      expect(store.acceptedProposals).toEqual([]);
      expect(store.rejectedProposals).toEqual([]);
      expect(store.expiredProposals).toEqual([]);
      expect(store.activeAgreements).toEqual([]);
      expect(store.inProgressAgreements).toEqual([]);
      expect(store.completedAgreements).toEqual([]);
      expect(store.cancelledAgreements).toEqual([]);
      expect(store.disputedAgreements).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.cache).toBeDefined();
    });
  });

  describe('Exchange Proposal Operations', () => {
    describe('createExchangeProposal', () => {
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

        const result = await runEffect(store.createExchangeProposal(input));

        expect(result).toEqual(mockRecord);
        expect(mockExchangesService.createExchangeProposal).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
      });

      it('should handle errors when creating exchange proposal', async () => {
        const input: CreateExchangeProposalInput = {
          proposal_type: 'DirectResponse',
          target_entity_hash: createMockActionHash('target-entity'),
          service_details: 'Test exchange services',
          terms: 'Test terms and conditions',
          exchange_medium: 'Test medium'
        };

        const errorService = createMockService({
          createExchangeProposal: vi.fn().mockReturnValue(E.fail(new ExchangeError({
            message: 'Creation failed',
            context: 'TEST_CONTEXT'
          })))
        });

        const errorStore = await createStoreWithService(errorService);

        await expect(runEffect(errorStore.createExchangeProposal(input))).rejects.toThrow();
        expect(errorStore.loading).toBe(false);
      });
    });

    describe('getAllProposals', () => {
      it('should get all proposals successfully', async () => {
        const result = await runEffect(store.getAllProposals());

        expect(result).toEqual(expect.any(Array));
        expect(store.exchangeProposals.length).toBe(1);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
        expect(mockExchangesService.getAllProposals).toHaveBeenCalled();
      });

      it('should handle errors when getting all proposals', async () => {
        const errorService = createMockService({
          getAllProposals: vi.fn().mockReturnValue(E.fail(new ExchangeError({
            message: 'Network error',
            context: 'GET_ALL_PROPOSALS'
          })))
        });

        const errorStore = await createStoreWithService(errorService);

        await expect(runEffect(errorStore.getAllProposals())).rejects.toThrow();
        expect(errorStore.loading).toBe(false);
      });

      it('should handle client not connected gracefully', async () => {
        const clientNotConnectedService = createMockService({
          getAllProposals: vi.fn().mockReturnValue(E.fail(new Error('Client not connected')))
        });

        const clientNotConnectedStore = await createStoreWithService(clientNotConnectedService);

        const result = await runEffect(clientNotConnectedStore.getAllProposals());
        expect(result).toEqual([]);
        expect(clientNotConnectedStore.loading).toBe(false);
      });
    });

    describe('getExchangeProposal', () => {
      it('should get exchange proposal successfully', async () => {
        const proposalHash = mockActionHash;
        
        // First populate cache by creating a proposal
        await runEffect(store.getAllProposals());

        const result = await runEffect(store.getExchangeProposal(proposalHash));

        expect(result).toBeDefined();
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
      });

      it('should return null for non-existent proposal', async () => {
        const nullService = createMockService({
          getExchangeProposal: vi.fn().mockReturnValue(E.succeed(null))
        });

        const nullStore = await createStoreWithService(nullService);
        const proposalHash = mockActionHash;

        const result = await runEffect(nullStore.getExchangeProposal(proposalHash));

        expect(result).toBeNull();
        expect(nullStore.loading).toBe(false);
      });

      it('should handle client not connected gracefully for single proposal', async () => {
        const clientNotConnectedService = createMockService({
          getExchangeProposal: vi.fn().mockReturnValue(E.fail(new Error('Client not connected')))
        });

        const clientNotConnectedStore = await createStoreWithService(clientNotConnectedService);
        const proposalHash = mockActionHash;

        const result = await runEffect(clientNotConnectedStore.getExchangeProposal(proposalHash));
        expect(result).toBeNull();
        expect(clientNotConnectedStore.loading).toBe(false);
      });
    });

    describe('updateProposalStatus', () => {
      it('should update proposal status successfully', async () => {
        // First populate cache by creating a proposal
        await runEffect(store.getAllProposals());

        const input: UpdateProposalStatusInput = {
          proposal_hash: mockActionHash,
          new_status: 'Accepted',
          reason: 'Proposal looks good'
        };

        const result = await runEffect(store.updateProposalStatus(input));

        expect(result).toEqual(mockActionHash);
        expect(mockExchangesService.updateProposalStatus).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
      });
    });

    describe('getProposalsByStatus', () => {
      it('should get proposals by status successfully', async () => {
        const status = 'Pending';

        const result = await runEffect(store.getProposalsByStatus(status));

        expect(result).toEqual(expect.any(Array));
        expect(mockExchangesService.getProposalsByStatus).toHaveBeenCalledWith(status);
        expect(store.loading).toBe(false);
      });
    });

    describe('deleteExchangeProposal', () => {
      it('should delete exchange proposal successfully', async () => {
        const proposalHash = mockActionHash;

        await runEffect(store.deleteExchangeProposal(proposalHash));

        expect(mockExchangesService.deleteExchangeProposal).toHaveBeenCalledWith(proposalHash);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
      });
    });
  });

  describe('Agreement Operations', () => {
    describe('createAgreement', () => {
      it('should create agreement successfully', async () => {
        const input: CreateAgreementInput = {
          proposal_hash: mockActionHash,
          service_details: 'Agreed services',
          agreed_terms: 'Agreed terms',
          exchange_medium: 'Test medium',
          exchange_value: '100',
          delivery_timeframe: 'Test timeframe',
          additional_conditions: 'Additional conditions'
        };

        const result = await runEffect(store.createAgreement(input));

        expect(result).toEqual(mockRecord);
        expect(mockExchangesService.createAgreement).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
      });
    });

    describe('getAllAgreements', () => {
      it('should get all agreements successfully', async () => {
        const result = await runEffect(store.getAllAgreements());

        expect(result).toEqual(expect.any(Array));
        expect(store.agreements.length).toBe(1);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
        expect(mockExchangesService.getAllAgreements).toHaveBeenCalled();
      });

      it('should handle client not connected gracefully for agreements', async () => {
        const clientNotConnectedService = createMockService({
          getAllAgreements: vi.fn().mockReturnValue(E.fail(new Error('Client not connected')))
        });

        const clientNotConnectedStore = await createStoreWithService(clientNotConnectedService);

        const result = await runEffect(clientNotConnectedStore.getAllAgreements());
        expect(result).toEqual([]);
        expect(clientNotConnectedStore.loading).toBe(false);
      });
    });

    describe('updateAgreementStatus', () => {
      it('should update agreement status successfully', async () => {
        // First populate cache by creating an agreement
        await runEffect(store.getAllAgreements());

        const input: UpdateAgreementStatusInput = {
          agreement_hash: mockActionHash,
          new_status: 'Active'
        };

        const result = await runEffect(store.updateAgreementStatus(input));

        expect(result).toEqual(mockActionHash);
        expect(mockExchangesService.updateAgreementStatus).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
      });
    });

    describe('validateCompletion', () => {
      it('should validate completion successfully', async () => {
        const input: ValidateCompletionInput = {
          agreement_hash: mockActionHash,
          validator_role: 'Provider'
        };

        const result = await runEffect(store.validateCompletion(input));

        expect(result).toEqual(mockActionHash);
        expect(mockExchangesService.validateCompletion).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
      });
    });
  });

  describe('Exchange Event Operations', () => {
    describe('createExchangeEvent', () => {
      it('should create exchange event successfully', async () => {
        const input: CreateExchangeEventInput = {
          agreement_hash: mockActionHash,
          event_type: 'ProgressUpdate',
          priority: 'Normal',
          title: 'Progress Update',
          description: 'Work is progressing well',
          progress_percentage: 50,
          attachments: ['file1.txt'],
          is_public: true,
          metadata: { key1: 'value1' }
        };

        const result = await runEffect(store.createExchangeEvent(input));

        expect(result).toEqual(mockRecord);
        expect(mockExchangesService.createExchangeEvent).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
      });
    });

    describe('getAllExchangeEvents', () => {
      it('should get all exchange events successfully', async () => {
        const result = await runEffect(store.getAllExchangeEvents());

        expect(result).toEqual(expect.any(Array));
        expect(store.exchangeEvents.length).toBe(1);
        expect(store.loading).toBe(false);
        expect(mockExchangesService.getAllExchangeEvents).toHaveBeenCalled();
      });

      it('should handle client not connected gracefully for events', async () => {
        const clientNotConnectedService = createMockService({
          getAllExchangeEvents: vi.fn().mockReturnValue(E.fail(new Error('Client not connected')))
        });

        const clientNotConnectedStore = await createStoreWithService(clientNotConnectedService);

        const result = await runEffect(clientNotConnectedStore.getAllExchangeEvents());
        expect(result).toEqual([]);
        expect(clientNotConnectedStore.loading).toBe(false);
      });
    });

    describe('getEventsForAgreement', () => {
      it('should get events for agreement successfully', async () => {
        const agreementHash = mockActionHash;

        const result = await runEffect(store.getEventsForAgreement(agreementHash));

        expect(result).toEqual(expect.any(Array));
        expect(mockExchangesService.getEventsForAgreement).toHaveBeenCalledWith(agreementHash);
        expect(store.loading).toBe(false);
      });
    });
  });

  describe('Exchange Review Operations', () => {
    describe('createMutualValidation', () => {
      it('should create mutual validation successfully', async () => {
        const input: CreateMutualValidationInput = {
          agreement_hash: mockActionHash,
          provider_validation: true,
          receiver_validation: true
        };

        const result = await runEffect(store.createMutualValidation(input));

        expect(result).toEqual(mockRecord);
        expect(mockExchangesService.createMutualValidation).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
      });
    });

    describe('createPublicReview', () => {
      it('should create public review successfully', async () => {
        const input: CreatePublicReviewInput = {
          agreement_hash: mockActionHash,
          provider_validation: true,
          receiver_validation: true,
          completed_on_time: true,
          completed_as_agreed: true,
          rating: 5,
          comments: 'Excellent work!',
          reviewer_type: 'Receiver'
        };

        const result = await runEffect(store.createPublicReview(input));

        expect(result).toEqual(mockRecord);
        expect(mockExchangesService.createPublicReview).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
      });
    });

    describe('getAllExchangeReviews', () => {
      it('should get all exchange reviews successfully', async () => {
        const result = await runEffect(store.getAllExchangeReviews());

        expect(result).toEqual(expect.any(Array));
        expect(store.exchangeReviews.length).toBe(1);
        expect(store.loading).toBe(false);
        expect(mockExchangesService.getAllExchangeReviews).toHaveBeenCalled();
      });

      it('should handle client not connected gracefully for reviews', async () => {
        const clientNotConnectedService = createMockService({
          getAllExchangeReviews: vi.fn().mockReturnValue(E.fail(new Error('Client not connected')))
        });

        const clientNotConnectedStore = await createStoreWithService(clientNotConnectedService);

        const result = await runEffect(clientNotConnectedStore.getAllExchangeReviews());
        expect(result).toEqual([]);
        expect(clientNotConnectedStore.loading).toBe(false);
      });
    });
  });

  describe('Exchange Cancellation Operations', () => {
    describe('createMutualCancellation', () => {
      it('should create mutual cancellation successfully', async () => {
        const input: CreateMutualCancellationInput = {
          agreement_hash: mockActionHash,
          reason: 'MutualAgreement',
          explanation: 'Both parties agreed to cancel',
          resolution_terms: 'No penalties'
        };

        const result = await runEffect(store.createMutualCancellation(input));

        expect(result).toEqual(mockRecord);
        expect(mockExchangesService.createMutualCancellation).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
        expect(store.error).toBeNull();
      });
    });

    describe('createUnilateralCancellation', () => {
      it('should create unilateral cancellation successfully', async () => {
        const input: CreateUnilateralCancellationInput = {
          agreement_hash: mockActionHash,
          reason: 'ProviderUnavailable',
          initiated_by: 'Provider',
          explanation: 'Provider became unavailable'
        };

        const result = await runEffect(store.createUnilateralCancellation(input));

        expect(result).toEqual(mockRecord);
        expect(mockExchangesService.createUnilateralCancellation).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
      });
    });

    describe('respondToCancellation', () => {
      it('should respond to cancellation successfully', async () => {
        const input: RespondToCancellationInput = {
          cancellation_hash: mockActionHash,
          consent: true,
          notes: 'I agree to the cancellation'
        };

        const result = await runEffect(store.respondToCancellation(input));

        expect(result).toEqual(mockActionHash);
        expect(mockExchangesService.respondToCancellation).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
      });
    });

    describe('adminReviewCancellation', () => {
      it('should admin review cancellation successfully', async () => {
        const input: AdminReviewCancellationInput = {
          cancellation_hash: mockActionHash,
          admin_notes: 'Cancellation approved',
          resolution_terms: 'Standard cancellation terms apply'
        };

        const result = await runEffect(store.adminReviewCancellation(input));

        expect(result).toEqual(mockActionHash);
        expect(mockExchangesService.adminReviewCancellation).toHaveBeenCalledWith(input);
        expect(store.loading).toBe(false);
      });
    });

    describe('getAllExchangeCancellations', () => {
      it('should get all exchange cancellations successfully', async () => {
        const result = await runEffect(store.getAllExchangeCancellations());

        expect(result).toEqual(expect.any(Array));
        expect(store.exchangeCancellations.length).toBe(1);
        expect(store.loading).toBe(false);
        expect(mockExchangesService.getAllExchangeCancellations).toHaveBeenCalled();
      });

      it('should handle client not connected gracefully for cancellations', async () => {
        const clientNotConnectedService = createMockService({
          getAllExchangeCancellations: vi.fn().mockReturnValue(E.fail(new Error('Client not connected')))
        });

        const clientNotConnectedStore = await createStoreWithService(clientNotConnectedService);

        const result = await runEffect(clientNotConnectedStore.getAllExchangeCancellations());
        expect(result).toEqual([]);
        expect(clientNotConnectedStore.loading).toBe(false);
      });
    });
  });

  describe('Cache Operations', () => {
    describe('invalidateCache', () => {
      it('should invalidate cache successfully', () => {
        expect(() => store.invalidateCache()).not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle generic service errors', async () => {
      const errorService = createMockService({
        getAllProposals: vi.fn().mockReturnValue(E.fail(new Error('Generic service error')))
      });

      const errorStore = await createStoreWithService(errorService);

      await expect(runEffect(errorStore.getAllProposals())).rejects.toThrow();
      expect(errorStore.loading).toBe(false);
    });

    it('should handle ExchangeError instances correctly', async () => {
      const exchangeError = new ExchangeError({
        message: 'Exchange specific error',
        context: 'TEST_CONTEXT'
      });

      const errorService = createMockService({
        createExchangeProposal: vi.fn().mockReturnValue(E.fail(exchangeError))
      });

      const errorStore = await createStoreWithService(errorService);

      const input: CreateExchangeProposalInput = {
        proposal_type: 'DirectResponse',
        target_entity_hash: createMockActionHash('target-entity'),
        service_details: 'Test services',
        terms: 'Test terms',
        exchange_medium: 'Test medium'
      };

      await expect(runEffect(errorStore.createExchangeProposal(input))).rejects.toThrow('Exchange specific error');
      expect(errorStore.loading).toBe(false);
    });
  });
});