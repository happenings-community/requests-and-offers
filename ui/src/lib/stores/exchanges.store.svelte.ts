import type { ActionHash, Record } from '@holochain/client';
import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
import {
  ExchangesServiceTag,
  ExchangesServiceLive
} from '$lib/services/zomes/exchanges.service';
import type {
  UIExchangeProposal,
  UIAgreement,
  UIExchangeEvent,
  UIExchangeReview,
  UIExchangeCancellation
} from '$lib/types/ui';
import type {
  ExchangeProposal,
  Agreement,
  ExchangeEvent,
  ExchangeReview,
  ExchangeCancellation,
  CreateExchangeProposalInput,
  UpdateProposalStatusInput,
  CreateAgreementInput,
  UpdateAgreementStatusInput,
  ValidateCompletionInput,
  CreateExchangeEventInput,
  CreateMutualValidationInput,
  CreatePublicReviewInput,
  CreateMutualCancellationInput,
  CreateUnilateralCancellationInput,
  RespondToCancellationInput,
  AdminReviewCancellationInput,
  ProposalStatus,
  AgreementStatus
} from '$lib/schemas/exchanges.schemas';

import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { Effect as E, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import { CacheNotFoundError } from '$lib/errors';
import { CACHE_EXPIRY } from '$lib/utils/constants';
import { EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';

// Import our standardized store helpers
import {
  withLoadingState,
  createErrorHandler,
  createGenericCacheSyncHelper,
  createEntityFetcher,
  createStatusAwareEventEmitters,
  createUIEntityFromRecord,
  createStatusTransitionHelper,
  createCacheLookupFunction,
  createEntityCreationHelper,
  processMultipleRecordCollections,
  type CacheableEntity,
  type LoadingStateSetter,
  type EntityStatus
} from '$lib/utils/store-helpers';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = CACHE_EXPIRY.EXCHANGES;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ExchangesStore = {
  // Core entity state
  readonly exchangeProposals: UIExchangeProposal[];
  readonly agreements: UIAgreement[];
  readonly exchangeEvents: UIExchangeEvent[];
  readonly exchangeReviews: UIExchangeReview[];
  readonly exchangeCancellations: UIExchangeCancellation[];
  
  // Status-filtered state for proposals
  readonly pendingProposals: UIExchangeProposal[];
  readonly acceptedProposals: UIExchangeProposal[];
  readonly rejectedProposals: UIExchangeProposal[];
  readonly expiredProposals: UIExchangeProposal[];
  
  // Status-filtered state for agreements
  readonly activeAgreements: UIAgreement[];
  readonly inProgressAgreements: UIAgreement[];
  readonly completedAgreements: UIAgreement[];
  readonly cancelledAgreements: UIAgreement[];
  readonly disputedAgreements: UIAgreement[];
  
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIExchangeProposal | UIAgreement | UIExchangeEvent | UIExchangeReview | UIExchangeCancellation>;

  // Exchange Proposal methods
  createExchangeProposal: (input: CreateExchangeProposalInput) => E.Effect<Record, ExchangeError>;
  getExchangeProposal: (proposalHash: ActionHash) => E.Effect<UIExchangeProposal | null, ExchangeError>;
  updateProposalStatus: (input: UpdateProposalStatusInput) => E.Effect<ActionHash, ExchangeError>;
  getProposalsForEntity: (entityHash: ActionHash) => E.Effect<UIExchangeProposal[], ExchangeError>;
  getProposalsByStatus: (status: ProposalStatus) => E.Effect<UIExchangeProposal[], ExchangeError>;
  getAllProposals: () => E.Effect<UIExchangeProposal[], ExchangeError>;
  deleteExchangeProposal: (proposalHash: ActionHash) => E.Effect<void, ExchangeError>;

  // Agreement methods
  createAgreement: (input: CreateAgreementInput) => E.Effect<Record, ExchangeError>;
  getAgreement: (agreementHash: ActionHash) => E.Effect<UIAgreement | null, ExchangeError>;
  updateAgreementStatus: (input: UpdateAgreementStatusInput) => E.Effect<ActionHash, ExchangeError>;
  validateCompletion: (input: ValidateCompletionInput) => E.Effect<ActionHash, ExchangeError>;
  getAgreementsByStatus: (status: AgreementStatus) => E.Effect<UIAgreement[], ExchangeError>;
  getAllAgreements: () => E.Effect<UIAgreement[], ExchangeError>;
  getAgreementsForAgent: (agentPubKey: ActionHash) => E.Effect<UIAgreement[], ExchangeError>;

  // Exchange Event methods
  createExchangeEvent: (input: CreateExchangeEventInput) => E.Effect<Record, ExchangeError>;
  getEventsForAgreement: (agreementHash: ActionHash) => E.Effect<UIExchangeEvent[], ExchangeError>;
  getAllExchangeEvents: () => E.Effect<UIExchangeEvent[], ExchangeError>;

  // Exchange Review methods
  createMutualValidation: (input: CreateMutualValidationInput) => E.Effect<Record, ExchangeError>;
  createPublicReview: (input: CreatePublicReviewInput) => E.Effect<Record, ExchangeError>;
  getReviewsForAgreement: (agreementHash: ActionHash) => E.Effect<UIExchangeReview[], ExchangeError>;
  getAllExchangeReviews: () => E.Effect<UIExchangeReview[], ExchangeError>;

  // Exchange Cancellation methods
  createMutualCancellation: (input: CreateMutualCancellationInput) => E.Effect<Record, ExchangeError>;
  createUnilateralCancellation: (input: CreateUnilateralCancellationInput) => E.Effect<Record, ExchangeError>;
  respondToCancellation: (input: RespondToCancellationInput) => E.Effect<ActionHash, ExchangeError>;
  adminReviewCancellation: (input: AdminReviewCancellationInput) => E.Effect<ActionHash, ExchangeError>;
  getCancellationsForAgreement: (agreementHash: ActionHash) => E.Effect<UIExchangeCancellation[], ExchangeError>;
  getAllExchangeCancellations: () => E.Effect<UIExchangeCancellation[], ExchangeError>;

  // Utility methods
  invalidateCache: () => void;
};

// ============================================================================
// ENTITY CREATION HELPERS - The 9 Standardized Helper Functions
// ============================================================================

/**
 * 1. Entity Creation Helper - Creates UIExchangeProposal from records
 */
const createUIExchangeProposal = createUIEntityFromRecord<ExchangeProposal, UIExchangeProposal>(
  (entry, actionHash, timestamp, additionalData) => ({
    ...entry,
    original_action_hash: actionHash,
    previous_action_hash: actionHash,
    creator: actionHash, // TODO: Extract creator from record
    created_at: timestamp,
    updated_at: timestamp,
    target_entity_hash: additionalData?.target_entity_hash as ActionHash,
    responder_entity_hash: additionalData?.responder_entity_hash as ActionHash
  })
);

/**
 * 1. Entity Creation Helper - Creates UIAgreement from records
 */
const createUIAgreement = createUIEntityFromRecord<Agreement, UIAgreement>(
  (entry, actionHash, timestamp, additionalData) => ({
    ...entry,
    original_action_hash: actionHash,
    previous_action_hash: actionHash,
    creator: actionHash, // TODO: Extract creator from record
    created_at: timestamp,
    updated_at: timestamp,
    proposal_hash: additionalData?.proposal_hash as ActionHash,
    provider_hash: additionalData?.provider_hash as ActionHash,
    receiver_hash: additionalData?.receiver_hash as ActionHash
  })
);

/**
 * 1. Entity Creation Helper - Creates UIExchangeEvent from records
 */
const createUIExchangeEvent = createUIEntityFromRecord<ExchangeEvent, UIExchangeEvent>(
  (entry, actionHash, timestamp, additionalData) => ({
    ...entry,
    original_action_hash: actionHash,
    previous_action_hash: actionHash,
    creator: actionHash, // TODO: Extract creator from record
    created_at: timestamp,
    updated_at: timestamp,
    agreement_hash: additionalData?.agreement_hash as ActionHash
  })
);

/**
 * 1. Entity Creation Helper - Creates UIExchangeReview from records
 */
const createUIExchangeReview = createUIEntityFromRecord<ExchangeReview, UIExchangeReview>(
  (entry, actionHash, timestamp, additionalData) => ({
    ...entry,
    original_action_hash: actionHash,
    previous_action_hash: actionHash,
    creator: actionHash, // TODO: Extract creator from record
    created_at: timestamp,
    updated_at: timestamp,
    agreement_hash: additionalData?.agreement_hash as ActionHash,
    reviewer_hash: additionalData?.reviewer_hash as ActionHash
  })
);

/**
 * 1. Entity Creation Helper - Creates UIExchangeCancellation from records
 */
const createUIExchangeCancellation = createUIEntityFromRecord<ExchangeCancellation, UIExchangeCancellation>(
  (entry, actionHash, timestamp, additionalData) => ({
    ...entry,
    original_action_hash: actionHash,
    previous_action_hash: actionHash,
    creator: actionHash, // TODO: Extract creator from record
    created_at: timestamp,
    updated_at: timestamp,
    agreement_hash: additionalData?.agreement_hash as ActionHash,
    initiator_hash: additionalData?.initiator_hash as ActionHash
  })
);

// ============================================================================
// ERROR HANDLING - Helper Function 8
// ============================================================================

/**
 * 8. Standardized error handler for Exchange operations
 */
const handleExchangeError = createErrorHandler(
  ExchangeError.fromError,
  'Exchange operation failed'
);

// ============================================================================
// EVENT EMISSION HELPERS - Helper Function 3
// ============================================================================

/**
 * 3. Create standardized event emitters for Exchanges
 */
const exchangeEventEmitters = createStatusAwareEventEmitters<
  UIExchangeProposal | UIAgreement | UIExchangeEvent | UIExchangeReview | UIExchangeCancellation
>('exchange');

// ============================================================================
// DATA FETCHING HELPERS - Helper Function 4
// ============================================================================

/**
 * 4. Create standardized entity fetcher for Exchanges
 */
const exchangeFetcher = createEntityFetcher<
  UIExchangeProposal | UIAgreement | UIExchangeEvent | UIExchangeReview | UIExchangeCancellation,
  ExchangeError
>(handleExchangeError);

// ============================================================================
// CACHE LOOKUP FUNCTIONS - Helper Function 9
// ============================================================================

/**
 * 9. Cache lookup function for exchange proposals
 */
const exchangeProposalCacheLookup = (key: string): E.Effect<UIExchangeProposal, CacheNotFoundError, never> => {
  return pipe(
    E.gen(function* () {
      const exchangesService = yield* ExchangesServiceTag;
      const hash = decodeHashFromBase64(key);
      const record = yield* exchangesService.getExchangeProposal(hash);

      if (!record) {
        return yield* E.fail(new CacheNotFoundError({ key }));
      }

      const entity = createUIExchangeProposal(record, {});
      if (!entity) {
        return yield* E.fail(new CacheNotFoundError({ key }));
      }

      return entity;
    }),
    E.catchAll(() => E.fail(new CacheNotFoundError({ key }))),
    E.provide(ExchangesServiceLive),
    E.provide(HolochainClientLive)
  );
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

/**
 * EXCHANGES STORE - IMPLEMENTING THE 9 STANDARDIZED HELPER FUNCTIONS
 * 
 * This store follows the ServiceTypes architectural template and implements:
 * 
 * 1. createUIEntityFromRecord - Entity creation from Holochain records
 * 2. createGenericCacheSyncHelper - Cache-to-state synchronization  
 * 3. createStatusAwareEventEmitters - Type-safe event emission
 * 4. withLoadingState - Consistent loading/error state management
 * 5. createStatusTransitionHelper - Status workflow management
 * 6. createEntityCreationHelper - Standardized entity creation
 * 7. processMultipleRecordCollections - Complex API response handling
 * 8. createErrorHandler - Domain-specific error handling
 * 9. createCacheLookupFunction - Cache miss handling with service fallback
 * 
 * @returns An Effect that creates an exchanges store with state and methods
 */
export const createExchangesStore = (): E.Effect<
  ExchangesStore,
  never,
  ExchangesServiceTag | CacheServiceTag
> =>
  E.gen(function* () {
    const exchangesService = yield* ExchangesServiceTag;
    const cacheService = yield* CacheServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================
    
    // Core entity arrays
    const exchangeProposals: UIExchangeProposal[] = $state([]);
    const agreements: UIAgreement[] = $state([]);
    const exchangeEvents: UIExchangeEvent[] = $state([]);
    const exchangeReviews: UIExchangeReview[] = $state([]);
    const exchangeCancellations: UIExchangeCancellation[] = $state([]);
    
    // Status-filtered arrays for proposals
    const pendingProposals: UIExchangeProposal[] = $state([]);
    const acceptedProposals: UIExchangeProposal[] = $state([]);
    const rejectedProposals: UIExchangeProposal[] = $state([]);
    const expiredProposals: UIExchangeProposal[] = $state([]);
    
    // Status-filtered arrays for agreements
    const activeAgreements: UIAgreement[] = $state([]);
    const inProgressAgreements: UIAgreement[] = $state([]);
    const completedAgreements: UIAgreement[] = $state([]);
    const cancelledAgreements: UIAgreement[] = $state([]);
    const disputedAgreements: UIAgreement[] = $state([]);
    
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // ========================================================================
    // HELPER INITIALIZATION WITH STANDARDIZED UTILITIES
    // ========================================================================

    // 4. LOADING STATE MANAGEMENT - Using LoadingStateSetter interface
    const setters: LoadingStateSetter = {
      setLoading: (value) => {
        loading = value;
      },
      setError: (value) => {
        error = value;
      }
    };

    // 2. CACHE SYNCHRONIZATION - Using createGenericCacheSyncHelper
    const { syncCacheToState } = createGenericCacheSyncHelper({
      all: exchangeProposals,
      Pending: pendingProposals,
      Accepted: acceptedProposals,
      Rejected: rejectedProposals,
      Expired: expiredProposals
    });

    // 3. EVENT EMITTERS - Using createStatusAwareEventEmitters
    const eventEmitters = exchangeEventEmitters;

    // 9. CACHE MANAGEMENT - Using standardized cache lookup pattern
    const cache = yield* cacheService.createEntityCache<
      UIExchangeProposal | UIAgreement | UIExchangeEvent | UIExchangeReview | UIExchangeCancellation
    >(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      exchangeProposalCacheLookup // Main cache lookup for proposals
    );

    // 6. ENTITY CREATION - Using createEntityCreationHelper
    const { createEntity: createProposalEntity } = createEntityCreationHelper(createUIExchangeProposal);
    const { createEntity: createAgreementEntity } = createEntityCreationHelper(createUIAgreement);
    const { createEntity: createEventEntity } = createEntityCreationHelper(createUIExchangeEvent);
    const { createEntity: createReviewEntity } = createEntityCreationHelper(createUIExchangeReview);
    const { createEntity: createCancellationEntity } = createEntityCreationHelper(createUIExchangeCancellation);

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
    };

    // ========================================================================
    // EXCHANGE PROPOSAL METHODS
    // ========================================================================

    const createExchangeProposal = (input: CreateExchangeProposalInput): E.Effect<Record, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.createExchangeProposal(input),
          E.tap((record) => {
            const entity = createUIExchangeProposal(record, { 
              target_entity_hash: input.target_entity_hash,
              responder_entity_hash: input.responder_entity_hash 
            });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_EXCHANGE_PROPOSAL))
          )
        )
      )(setters);

    const getExchangeProposal = (
      proposalHash: ActionHash
    ): E.Effect<UIExchangeProposal | null, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          cache.get(encodeHashToBase64(proposalHash)),
          E.flatMap((cachedProposal) => {
            if (cachedProposal && 'proposal_type' in cachedProposal) {
              return E.succeed(cachedProposal as UIExchangeProposal);
            }

            return pipe(
              exchangesService.getExchangeProposal(proposalHash),
              E.map((record) => {
                if (!record) {
                  return null;
                }

                const proposal = createUIExchangeProposal(record, {});
                if (proposal) {
                  E.runSync(cache.set(encodeHashToBase64(proposalHash), proposal));
                  syncCacheToState(proposal, 'add');
                }
                return proposal;
              }),
              E.catchAll((error) => {
                const errorMessage = String(error);
                if (errorMessage.includes('Client not connected')) {
                  console.warn('Holochain client not connected, returning null');
                  return E.succeed(null);
                }
                return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_EXCHANGE_PROPOSAL));
              })
            );
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_EXCHANGE_PROPOSAL))
          )
        )
      )(setters);

    const updateProposalStatus = (input: UpdateProposalStatusInput): E.Effect<ActionHash, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.updateProposalStatus(input),
          E.tap((actionHash) => {
            // Update cache and state
            const hashString = encodeHashToBase64(input.proposal_hash);
            const cached = E.runSync(E.either(cache.get(hashString)));
            if (cached._tag === 'Right' && cached.right && 'status' in cached.right) {
              const updatedProposal = { 
                ...cached.right as UIExchangeProposal, 
                status: input.new_status,
                updated_at: Date.now()
              };
              E.runSync(cache.set(hashString, updatedProposal));
              syncCacheToState(updatedProposal, 'update');
              eventEmitters.emitUpdated(updatedProposal);
            }
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.UPDATE_PROPOSAL_STATUS))
          )
        )
      )(setters);

    const getProposalsForEntity = (entityHash: ActionHash): E.Effect<UIExchangeProposal[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getProposalsForEntity(entityHash),
          E.map((records) => {
            const proposals = records.map(record => createUIExchangeProposal(record, {})).filter(Boolean) as UIExchangeProposal[];
            // Update cache and state
            proposals.forEach(proposal => {
              if (proposal.original_action_hash) {
                E.runSync(cache.set(encodeHashToBase64(proposal.original_action_hash), proposal));
                syncCacheToState(proposal, 'add');
              }
            });
            return proposals;
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_PROPOSALS_FOR_ENTITY))
          )
        )
      )(setters);

    const getProposalsByStatus = (status: ProposalStatus): E.Effect<UIExchangeProposal[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getProposalsByStatus(status),
          E.map((records) => {
            const proposals = records.map(record => createUIExchangeProposal(record, {})).filter(Boolean) as UIExchangeProposal[];
            // Update status-specific arrays
            const targetArray = status === 'Pending' ? pendingProposals :
                              status === 'Accepted' ? acceptedProposals :
                              status === 'Rejected' ? rejectedProposals :
                              status === 'Expired' ? expiredProposals : 
                              exchangeProposals;
            targetArray.splice(0, targetArray.length, ...proposals);
            return proposals;
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_PROPOSALS_BY_STATUS))
          )
        )
      )(setters);

    const getAllProposals = (): E.Effect<UIExchangeProposal[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getAllProposals(),
          E.map((records) => {
            const proposals = records.map(record => createUIExchangeProposal(record, {})).filter(Boolean) as UIExchangeProposal[];
            // Update main array and cache
            exchangeProposals.splice(0, exchangeProposals.length, ...proposals);
            proposals.forEach(proposal => {
              if (proposal.original_action_hash) {
                E.runSync(cache.set(encodeHashToBase64(proposal.original_action_hash), proposal));
              }
            });
            return proposals;
          }),
          E.catchAll((error) => {
            const errorMessage = String(error);
            if (errorMessage.includes('Client not connected')) {
              console.warn('Holochain client not connected, returning empty array');
              return E.succeed([]);
            }
            return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_ALL_PROPOSALS));
          })
        )
      )(setters);

    const deleteExchangeProposal = (proposalHash: ActionHash): E.Effect<void, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.deleteExchangeProposal(proposalHash),
          E.tap(() => {
            E.runSync(cache.invalidate(encodeHashToBase64(proposalHash)));
            const dummyProposal = { original_action_hash: proposalHash } as UIExchangeProposal;
            syncCacheToState(dummyProposal, 'remove');
          }),
          E.tap(() => E.sync(() => eventEmitters.emitDeleted(proposalHash))),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.DELETE_EXCHANGE_PROPOSAL))
          )
        )
      )(setters);

    // ========================================================================
    // AGREEMENT METHODS
    // ========================================================================

    const createAgreement = (input: CreateAgreementInput): E.Effect<Record, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.createAgreement(input),
          E.tap((record) => {
            const entity = createUIAgreement(record, { proposal_hash: input.proposal_hash });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              agreements.push(entity);
              eventEmitters.emitCreated(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_AGREEMENT))
          )
        )
      )(setters);

    const getAgreement = (agreementHash: ActionHash): E.Effect<UIAgreement | null, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          cache.get(encodeHashToBase64(agreementHash)),
          E.flatMap((cachedAgreement) => {
            if (cachedAgreement && 'agreed_terms' in cachedAgreement) {
              return E.succeed(cachedAgreement as UIAgreement);
            }

            return pipe(
              exchangesService.getAgreement(agreementHash),
              E.map((record) => {
                if (!record) {
                  return null;
                }

                const agreement = createUIAgreement(record, {});
                if (agreement) {
                  E.runSync(cache.set(encodeHashToBase64(agreementHash), agreement));
                  const existingIndex = agreements.findIndex(a => 
                    a.original_action_hash && encodeHashToBase64(a.original_action_hash) === encodeHashToBase64(agreementHash)
                  );
                  if (existingIndex === -1) {
                    agreements.push(agreement);
                  }
                }
                return agreement;
              })
            );
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_AGREEMENT))
          )
        )
      )(setters);

    const updateAgreementStatus = (input: UpdateAgreementStatusInput): E.Effect<ActionHash, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.updateAgreementStatus(input),
          E.tap((actionHash) => {
            // Update cache and state
            const hashString = encodeHashToBase64(input.agreement_hash);
            const cached = E.runSync(E.either(cache.get(hashString)));
            if (cached._tag === 'Right' && cached.right && 'status' in cached.right) {
              const updatedAgreement = { 
                ...cached.right as UIAgreement, 
                status: input.new_status,
                updated_at: Date.now()
              };
              E.runSync(cache.set(hashString, updatedAgreement));
              
              // Update in agreements array
              const index = agreements.findIndex(a => 
                a.original_action_hash && encodeHashToBase64(a.original_action_hash) === hashString
              );
              if (index !== -1) {
                agreements[index] = updatedAgreement;
              }
              
              eventEmitters.emitUpdated(updatedAgreement);
            }
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.UPDATE_AGREEMENT_STATUS))
          )
        )
      )(setters);

    const validateCompletion = (input: ValidateCompletionInput): E.Effect<ActionHash, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.validateCompletion(input),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.VALIDATE_COMPLETION))
          )
        )
      )(setters);

    const getAgreementsByStatus = (status: AgreementStatus): E.Effect<UIAgreement[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getAgreementsByStatus(status),
          E.map((records) => {
            const agreementEntities = records.map(record => createUIAgreement(record, {})).filter(Boolean) as UIAgreement[];
            // Update status-specific arrays
            const targetArray = status === 'Active' ? activeAgreements :
                              status === 'InProgress' ? inProgressAgreements :
                              status === 'Completed' ? completedAgreements :
                              ['CancelledMutual', 'CancelledProvider', 'CancelledReceiver', 'Failed'].includes(status) ? cancelledAgreements :
                              status === 'Disputed' ? disputedAgreements : 
                              agreements;
            targetArray.splice(0, targetArray.length, ...agreementEntities);
            return agreementEntities;
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_AGREEMENTS_BY_STATUS))
          )
        )
      )(setters);

    const getAllAgreements = (): E.Effect<UIAgreement[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getAllAgreements(),
          E.map((records) => {
            const agreementEntities = records.map(record => createUIAgreement(record, {})).filter(Boolean) as UIAgreement[];
            agreements.splice(0, agreements.length, ...agreementEntities);
            agreementEntities.forEach(agreement => {
              if (agreement.original_action_hash) {
                E.runSync(cache.set(encodeHashToBase64(agreement.original_action_hash), agreement));
              }
            });
            return agreementEntities;
          }),
          E.catchAll((error) => {
            const errorMessage = String(error);
            if (errorMessage.includes('Client not connected')) {
              console.warn('Holochain client not connected, returning empty agreements array');
              return E.succeed([]);
            }
            return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_ALL_AGREEMENTS));
          })
        )
      )(setters);

    const getAgreementsForAgent = (agentPubKey: ActionHash): E.Effect<UIAgreement[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getAgreementsForAgent(agentPubKey),
          E.map((records) => {
            const agreementEntities = records.map(record => createUIAgreement(record, {})).filter(Boolean) as UIAgreement[];
            // Cache the agreements
            agreementEntities.forEach(agreement => {
              if (agreement.original_action_hash) {
                E.runSync(cache.set(encodeHashToBase64(agreement.original_action_hash), agreement));
              }
            });
            return agreementEntities;
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_AGREEMENTS_FOR_AGENT))
          )
        )
      )(setters);

    // ========================================================================
    // EXCHANGE EVENT METHODS
    // ========================================================================

    const createExchangeEvent = (input: CreateExchangeEventInput): E.Effect<Record, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.createExchangeEvent(input),
          E.tap((record) => {
            const entity = createUIExchangeEvent(record, { agreement_hash: input.agreement_hash });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              exchangeEvents.push(entity);
              eventEmitters.emitCreated(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_EXCHANGE_EVENT))
          )
        )
      )(setters);

    const getEventsForAgreement = (agreementHash: ActionHash): E.Effect<UIExchangeEvent[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getEventsForAgreement(agreementHash),
          E.map((records) => {
            const eventEntities = records.map(record => createUIExchangeEvent(record, { agreement_hash: agreementHash })).filter(Boolean) as UIExchangeEvent[];
            // Cache the events
            eventEntities.forEach(event => {
              if (event.original_action_hash) {
                E.runSync(cache.set(encodeHashToBase64(event.original_action_hash), event));
              }
            });
            return eventEntities;
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_EVENTS_FOR_AGREEMENT))
          )
        )
      )(setters);

    const getAllExchangeEvents = (): E.Effect<UIExchangeEvent[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getAllExchangeEvents(),
          E.map((records) => {
            const eventEntities = records.map(record => createUIExchangeEvent(record, {})).filter(Boolean) as UIExchangeEvent[];
            exchangeEvents.splice(0, exchangeEvents.length, ...eventEntities);
            eventEntities.forEach(event => {
              if (event.original_action_hash) {
                E.runSync(cache.set(encodeHashToBase64(event.original_action_hash), event));
              }
            });
            return eventEntities;
          }),
          E.catchAll((error) => {
            const errorMessage = String(error);
            if (errorMessage.includes('Client not connected')) {
              console.warn('Holochain client not connected, returning empty events array');
              return E.succeed([]);
            }
            return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_ALL_EXCHANGE_EVENTS));
          })
        )
      )(setters);

    // ========================================================================
    // EXCHANGE REVIEW METHODS
    // ========================================================================

    const createMutualValidation = (input: CreateMutualValidationInput): E.Effect<Record, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.createMutualValidation(input),
          E.tap((record) => {
            const entity = createUIExchangeReview(record, { agreement_hash: input.agreement_hash });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              exchangeReviews.push(entity);
              eventEmitters.emitCreated(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_MUTUAL_VALIDATION))
          )
        )
      )(setters);

    const createPublicReview = (input: CreatePublicReviewInput): E.Effect<Record, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.createPublicReview(input),
          E.tap((record) => {
            const entity = createUIExchangeReview(record, { agreement_hash: input.agreement_hash });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              exchangeReviews.push(entity);
              eventEmitters.emitCreated(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_PUBLIC_REVIEW))
          )
        )
      )(setters);

    const getReviewsForAgreement = (agreementHash: ActionHash): E.Effect<UIExchangeReview[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getReviewsForAgreement(agreementHash),
          E.map((records) => {
            const reviewEntities = records.map(record => createUIExchangeReview(record, { agreement_hash: agreementHash })).filter(Boolean) as UIExchangeReview[];
            // Cache the reviews
            reviewEntities.forEach(review => {
              if (review.original_action_hash) {
                E.runSync(cache.set(encodeHashToBase64(review.original_action_hash), review));
              }
            });
            return reviewEntities;
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_REVIEWS_FOR_AGREEMENT))
          )
        )
      )(setters);

    const getAllExchangeReviews = (): E.Effect<UIExchangeReview[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getAllExchangeReviews(),
          E.map((records) => {
            const reviewEntities = records.map(record => createUIExchangeReview(record, {})).filter(Boolean) as UIExchangeReview[];
            exchangeReviews.splice(0, exchangeReviews.length, ...reviewEntities);
            reviewEntities.forEach(review => {
              if (review.original_action_hash) {
                E.runSync(cache.set(encodeHashToBase64(review.original_action_hash), review));
              }
            });
            return reviewEntities;
          }),
          E.catchAll((error) => {
            const errorMessage = String(error);
            if (errorMessage.includes('Client not connected')) {
              console.warn('Holochain client not connected, returning empty reviews array');
              return E.succeed([]);
            }
            return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_ALL_EXCHANGE_REVIEWS));
          })
        )
      )(setters);

    // ========================================================================
    // EXCHANGE CANCELLATION METHODS
    // ========================================================================

    const createMutualCancellation = (input: CreateMutualCancellationInput): E.Effect<Record, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.createMutualCancellation(input),
          E.tap((record) => {
            const entity = createUIExchangeCancellation(record, { agreement_hash: input.agreement_hash });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              exchangeCancellations.push(entity);
              eventEmitters.emitCreated(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_MUTUAL_CANCELLATION))
          )
        )
      )(setters);

    const createUnilateralCancellation = (input: CreateUnilateralCancellationInput): E.Effect<Record, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.createUnilateralCancellation(input),
          E.tap((record) => {
            const entity = createUIExchangeCancellation(record, { agreement_hash: input.agreement_hash });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              exchangeCancellations.push(entity);
              eventEmitters.emitCreated(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_UNILATERAL_CANCELLATION))
          )
        )
      )(setters);

    const respondToCancellation = (input: RespondToCancellationInput): E.Effect<ActionHash, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.respondToCancellation(input),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPOND_TO_CANCELLATION))
          )
        )
      )(setters);

    const adminReviewCancellation = (input: AdminReviewCancellationInput): E.Effect<ActionHash, ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.adminReviewCancellation(input),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.ADMIN_REVIEW_CANCELLATION))
          )
        )
      )(setters);

    const getCancellationsForAgreement = (agreementHash: ActionHash): E.Effect<UIExchangeCancellation[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getCancellationsForAgreement(agreementHash),
          E.map((records) => {
            const cancellationEntities = records.map(record => createUIExchangeCancellation(record, { agreement_hash: agreementHash })).filter(Boolean) as UIExchangeCancellation[];
            // Cache the cancellations
            cancellationEntities.forEach(cancellation => {
              if (cancellation.original_action_hash) {
                E.runSync(cache.set(encodeHashToBase64(cancellation.original_action_hash), cancellation));
              }
            });
            return cancellationEntities;
          }),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_CANCELLATIONS_FOR_AGREEMENT))
          )
        )
      )(setters);

    const getAllExchangeCancellations = (): E.Effect<UIExchangeCancellation[], ExchangeError> =>
      withLoadingState(() =>
        pipe(
          exchangesService.getAllExchangeCancellations(),
          E.map((records) => {
            const cancellationEntities = records.map(record => createUIExchangeCancellation(record, {})).filter(Boolean) as UIExchangeCancellation[];
            exchangeCancellations.splice(0, exchangeCancellations.length, ...cancellationEntities);
            cancellationEntities.forEach(cancellation => {
              if (cancellation.original_action_hash) {
                E.runSync(cache.set(encodeHashToBase64(cancellation.original_action_hash), cancellation));
              }
            });
            return cancellationEntities;
          }),
          E.catchAll((error) => {
            const errorMessage = String(error);
            if (errorMessage.includes('Client not connected')) {
              console.warn('Holochain client not connected, returning empty cancellations array');
              return E.succeed([]);
            }
            return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_ALL_EXCHANGE_CANCELLATIONS));
          })
        )
      )(setters);

    // ========================================================================
    // STORE INTERFACE RETURN
    // ========================================================================

    return {
      // State getters
      get exchangeProposals() {
        return exchangeProposals;
      },
      get agreements() {
        return agreements;
      },
      get exchangeEvents() {
        return exchangeEvents;
      },
      get exchangeReviews() {
        return exchangeReviews;
      },
      get exchangeCancellations() {
        return exchangeCancellations;
      },
      get pendingProposals() {
        return pendingProposals;
      },
      get acceptedProposals() {
        return acceptedProposals;
      },
      get rejectedProposals() {
        return rejectedProposals;
      },
      get expiredProposals() {
        return expiredProposals;
      },
      get activeAgreements() {
        return activeAgreements;
      },
      get inProgressAgreements() {
        return inProgressAgreements;
      },
      get completedAgreements() {
        return completedAgreements;
      },
      get cancelledAgreements() {
        return cancelledAgreements;
      },
      get disputedAgreements() {
        return disputedAgreements;
      },
      get loading() {
        return loading;
      },
      get error() {
        return error;
      },
      get cache() {
        return cache;
      },

      // Exchange Proposal methods
      createExchangeProposal,
      getExchangeProposal,
      updateProposalStatus,
      getProposalsForEntity,
      getProposalsByStatus,
      getAllProposals,
      deleteExchangeProposal,

      // Agreement methods
      createAgreement,
      getAgreement,
      updateAgreementStatus,
      validateCompletion,
      getAgreementsByStatus,
      getAllAgreements,
      getAgreementsForAgent,

      // Exchange Event methods
      createExchangeEvent,
      getEventsForAgreement,
      getAllExchangeEvents,

      // Exchange Review methods
      createMutualValidation,
      createPublicReview,
      getReviewsForAgreement,
      getAllExchangeReviews,

      // Exchange Cancellation methods
      createMutualCancellation,
      createUnilateralCancellation,
      respondToCancellation,
      adminReviewCancellation,
      getCancellationsForAgreement,
      getAllExchangeCancellations,

      // Utility methods
      invalidateCache
    };
  });

// ============================================================================
// STORE INSTANCE CREATION
// ============================================================================

const exchangesStore: ExchangesStore = pipe(
  createExchangesStore(),
  E.provide(ExchangesServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientLive),
  E.runSync
);

export default exchangesStore;