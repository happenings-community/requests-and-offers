import type { ActionHash, Record, AgentPubKey } from '@holochain/client';
import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
import {
  ExchangesServiceTag,
  ExchangesServiceLive,
  type CreateExchangeResponseInput,
  type UpdateExchangeResponseStatusInput,
  type CreateAgreementInput,
  type MarkCompleteInput,
  type CreateReviewInput,
  type UIExchangeResponse,
  type UIAgreement,
  type UIExchangeReview,
  type ExchangeResponseStatus,
  type AgreementStatus,
  type ReviewerType,
  type ValidatorRole,
  type ReviewStatistics
} from '$lib/services/zomes/exchanges.service';

import { Effect as E, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import {
  createErrorHandler,
  createGenericCacheSyncHelper,
  createEntityFetcher,
  createStandardEventEmitters,
  createUIEntityFromRecord,
  withLoadingState,
  type LoadingStateSetter
} from '$lib/utils/store-helpers';
import { EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

export const createExchangesStore = () => {
  // ============================================================================
  // REACTIVE STATE
  // ============================================================================

  // Responses state
  let responses = $state<UIExchangeResponse[]>([]);
  let responsesByStatus = $state<{ [key in ExchangeResponseStatus]: UIExchangeResponse[] }>({
    Pending: [],
    Approved: [],
    Rejected: []
  });

  // Agreements state
  let agreements = $state<UIAgreement[]>([]);
  let agreementsByStatus = $state<{ [key in AgreementStatus]: UIAgreement[] }>({
    Active: [],
    Completed: []
  });

  // Reviews state
  let reviews = $state<UIExchangeReview[]>([]);
  let reviewStatistics = $state<ReviewStatistics>({
    total_reviews: 0,
    average_rating: 0,
    total_completed_exchanges: 0
  });

  // Loading states
  let isLoadingResponses = $state(false);
  let isLoadingAgreements = $state(false);
  let isLoadingReviews = $state(false);
  let isLoadingStatistics = $state(false);

  // Error states
  let responsesError = $state<ExchangeError | null>(null);
  let agreementsError = $state<ExchangeError | null>(null);
  let reviewsError = $state<ExchangeError | null>(null);
  let statisticsError = $state<ExchangeError | null>(null);

  // ============================================================================
  // HELPER FUNCTIONS (LoadingStateSetter Interface)
  // ============================================================================

  const responsesSetters: LoadingStateSetter = {
    setLoading: (loading: boolean) => { isLoadingResponses = loading; },
    setError: (error: string | null) => { responsesError = error ? ExchangeError.fromError(new Error(error), EXCHANGE_CONTEXTS.RESPONSES_FETCH) : null; }
  };

  const agreementsSetters: LoadingStateSetter = {
    setLoading: (loading: boolean) => { isLoadingAgreements = loading; },
    setError: (error: string | null) => { agreementsError = error ? ExchangeError.fromError(new Error(error), EXCHANGE_CONTEXTS.AGREEMENTS_FETCH) : null; }
  };

  const reviewsSetters: LoadingStateSetter = {
    setLoading: (loading: boolean) => { isLoadingReviews = loading; },
    setError: (error: string | null) => { reviewsError = error ? ExchangeError.fromError(new Error(error), EXCHANGE_CONTEXTS.REVIEWS_FETCH) : null; }
  };

  const statisticsSetters: LoadingStateSetter = {
    setLoading: (loading: boolean) => { isLoadingStatistics = loading; },
    setError: (error: string | null) => { statisticsError = error ? ExchangeError.fromError(new Error(error), EXCHANGE_CONTEXTS.REVIEW_STATISTICS) : null; }
  };

  // Status helper functions
  const updateResponsesByStatus = () => {
    responsesByStatus.Pending = responses.filter((r) => r.entry.status === 'Pending');
    responsesByStatus.Approved = responses.filter((r) => r.entry.status === 'Approved');
    responsesByStatus.Rejected = responses.filter((r) => r.entry.status === 'Rejected');
  };

  const updateAgreementsByStatus = () => {
    agreementsByStatus.Active = agreements.filter((a) => a.entry.status === 'Active');
    agreementsByStatus.Completed = agreements.filter((a) => a.entry.status === 'Completed');
  };

  // ============================================================================
  // EVENT EMITTERS (for future use)
  // ============================================================================

  const responseEventEmitters = createStandardEventEmitters<UIExchangeResponse>('exchange-response');
  const agreementEventEmitters = createStandardEventEmitters<UIAgreement>('agreement');
  const reviewEventEmitters = createStandardEventEmitters<UIExchangeReview>('review');

  // ============================================================================
  // CORE OPERATIONS
  // ============================================================================

  const fetchResponses = () =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const records = yield* exchangesService.getMyResponses(); // Changed to get only user's responses

          // Transform records to UI entities
          const uiResponses: UIExchangeResponse[] = records.map((record) => ({
            actionHash: record.signed_action.hashed.hash as ActionHash,
            entry: record.entry,
            targetEntityHash: '' as unknown as ActionHash, // TODO: Fetch from links
            responderEntityHash: null, // This would be populated from additional service calls
            proposerPubkey: record.signed_action.hashed.content.author.toString(),
            targetEntityType: 'request' as const, // This should be determined from actual data
            isLoading: false,
            lastUpdated: record.signed_action.hashed.content.timestamp
          }));

          responses = uiResponses;
          updateResponsesByStatus();
          return uiResponses;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH)))
      )
    )(responsesSetters);

  const fetchAgreements = () =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const records = yield* exchangesService.getAllAgreements();

          // Transform records to UI entities
          const uiAgreements: UIAgreement[] = records.map((record) => ({
            actionHash: record.signed_action.hashed.hash as ActionHash,
            entry: record.entry,
            responseHash: '' as unknown as ActionHash, // TODO: Fetch from links
            targetEntityHash: '' as unknown as ActionHash, // TODO: Fetch from links
            providerPubkey: record.signed_action.hashed.content.author.toString(),
            receiverPubkey: record.signed_action.hashed.content.author.toString(), // This should be determined from response
            isLoading: false,
            lastUpdated: record.signed_action.hashed.content.timestamp,
            canMarkComplete: record.entry.status === 'Active',
            awaitingCompletion: record.entry.status === 'Active' && (!record.entry.provider_completed || !record.entry.receiver_completed)
          }));

          agreements = uiAgreements;
          updateAgreementsByStatus();
          return uiAgreements;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.AGREEMENTS_FETCH)))
      )
    )(agreementsSetters);

  const fetchReviews = () =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const records = yield* exchangesService.getAllReviews();

          // Transform records to UI entities
          const uiReviews: UIExchangeReview[] = records.map((record) => ({
            actionHash: record.signed_action.hashed.hash as ActionHash,
            entry: record.entry,
            agreementHash: '' as unknown as ActionHash, // TODO: Fetch from links
            reviewerPubkey: record.signed_action.hashed.content.author.toString(),
            isLoading: false,
            lastUpdated: record.signed_action.hashed.content.timestamp
          }));

          reviews = uiReviews;
          return uiReviews;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.REVIEWS_FETCH)))
      )
    )(reviewsSetters);

  const fetchReviewStatistics = (agentPubkey?: string) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const stats = yield* exchangesService.getReviewStatistics(agentPubkey);
          reviewStatistics = stats;
          return stats;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.REVIEW_STATISTICS)))
      )
    )(statisticsSetters);

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  const createResponse = (input: CreateExchangeResponseInput) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const record = yield* exchangesService.createExchangeResponse(input);
          
          // Refresh responses after creation
          yield* fetchResponses();
          
          return record;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSE_CREATION)))
      )
    )(responsesSetters);

  const updateExchangeResponseStatus = (input: UpdateExchangeResponseStatusInput) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const hash = yield* exchangesService.updateExchangeResponseStatus(input);
          
          // Refresh responses after update
          yield* fetchResponses();
          
          return hash;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSE_UPDATE)))
      )
    )(responsesSetters);

  const createAgreement = (input: CreateAgreementInput) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const record = yield* exchangesService.createAgreement(input);
          
          // Refresh agreements after creation
          yield* fetchAgreements();
          
          return record;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.AGREEMENT_CREATION)))
      )
    )(agreementsSetters);

  const markAgreementComplete = (input: MarkCompleteInput) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const hash = yield* exchangesService.markAgreementComplete(input);
          
          // Refresh agreements after completion
          yield* fetchAgreements();
          
          return hash;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.AGREEMENT_COMPLETION)))
      )
    )(agreementsSetters);

  const createReview = (input: CreateReviewInput) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const record = yield* exchangesService.createReview(input);
          
          // Refresh reviews after creation
          yield* fetchReviews();
          
          return record;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.REVIEW_CREATION)))
      )
    )(reviewsSetters);

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================

  const pendingResponses = () => responsesByStatus.Pending;
  const approvedResponses = () => responsesByStatus.Approved;
  const rejectedResponses = () => responsesByStatus.Rejected;

  const activeAgreements = () => agreementsByStatus.Active;
  const completedAgreements = () => agreementsByStatus.Completed;

  const totalExchanges = () => responses.length + agreements.length;
  const completedExchangesCount = () => completedAgreements().length;

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // State getters
    responses: () => responses,
    agreements: () => agreements,
    reviews: () => reviews,
    reviewStatistics: () => reviewStatistics,

    // Status-based collections
    pendingResponses,
    approvedResponses,
    rejectedResponses,
    activeAgreements,
    completedAgreements,

    // Loading states
    isLoadingResponses: () => isLoadingResponses,
    isLoadingAgreements: () => isLoadingAgreements,
    isLoadingReviews: () => isLoadingReviews,
    isLoadingStatistics: () => isLoadingStatistics,

    // Error states
    responsesError: () => responsesError,
    agreementsError: () => agreementsError,
    reviewsError: () => reviewsError,
    statisticsError: () => statisticsError,

    // Core operations
    fetchResponses, // Fetches only user's responses
    fetchAllResponses: () =>
      withLoadingState(() =>
        pipe(
          E.gen(function* () {
            const exchangesService = yield* ExchangesServiceTag;
            const records = yield* exchangesService.getAllResponses();

            // Transform records to UI entities
            const uiResponses: UIExchangeResponse[] = records.map((record) => ({
              actionHash: record.signed_action.hashed.hash as ActionHash,
              entry: record.entry,
              targetEntityHash: '' as unknown as ActionHash, // TODO: Get from links
              responderEntityHash: null,
              proposerPubkey: record.signed_action.hashed.content.author.toString(),
              targetEntityType: 'request' as const,
              isLoading: false,
              lastUpdated: record.signed_action.hashed.content.timestamp
            }));

            // Update state
            responses = uiResponses;
            updateResponsesByStatus();
            return uiResponses;
          }),
          E.provide(ExchangesServiceLive),
          E.provide(HolochainClientLive),
          E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH)))
        )
      ),
    fetchResponsesForEntity: (entityHash: ActionHash) =>
      withLoadingState(() =>
        pipe(
          E.gen(function* () {
            const exchangesService = yield* ExchangesServiceTag;
            const records = yield* exchangesService.getResponsesForEntity(entityHash);

            // Transform records to UI entities
            const uiResponses: UIExchangeResponse[] = records.map((record) => ({
              actionHash: record.signed_action.hashed.hash as ActionHash,
              entry: record.entry,
              targetEntityHash: entityHash,
              responderEntityHash: null,
              proposerPubkey: record.signed_action.hashed.content.author.toString(),
              targetEntityType: 'request' as const,
              isLoading: false,
              lastUpdated: record.signed_action.hashed.content.timestamp
            }));

            return uiResponses;
          }),
          E.provide(ExchangesServiceLive),
          E.provide(HolochainClientLive),
          E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH)))
        )
      ),
    fetchMyResponses: () =>
      withLoadingState(() =>
        pipe(
          E.gen(function* () {
            const exchangesService = yield* ExchangesServiceTag;
            const records = yield* exchangesService.getMyResponses();

            // Transform records to UI entities
            const uiResponses: UIExchangeResponse[] = records.map((record) => ({
              actionHash: record.signed_action.hashed.hash as ActionHash,
              entry: record.entry,
              targetEntityHash: '' as unknown as ActionHash, // TODO: Get from links
              responderEntityHash: null,
              proposerPubkey: record.signed_action.hashed.content.author.toString(),
              targetEntityType: 'request' as const,
              isLoading: false,
              lastUpdated: record.signed_action.hashed.content.timestamp
            }));

            return uiResponses;
          }),
          E.provide(ExchangesServiceLive),
          E.provide(HolochainClientLive),
          E.catchAll((error) => E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH)))
        )
      ),
    fetchAgreements,
    fetchReviews,
    fetchReviewStatistics,

    // CRUD operations
    createResponse,
    updateExchangeResponseStatus,
    createAgreement,
    markAgreementComplete,
    createReview,

    // Computed properties
    totalExchanges,
    completedExchangesCount
  };
};