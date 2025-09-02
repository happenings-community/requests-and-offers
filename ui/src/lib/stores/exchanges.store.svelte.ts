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
import { type ExchangeResponse } from '$lib/schemas/exchanges.schemas';
import { decode } from '@msgpack/msgpack';

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

// Define a proper Entry type to handle Holochain entry structure
type HolochainEntry = {
  Present: {
    entry: Uint8Array;
  };
};

// ============================================================================
// UI ENTITY CREATION HELPERS - Following Standardized Store Helper Patterns
// ============================================================================

/**
 * Creates a UI exchange response from a Holochain record using standardized helpers
 * This demonstrates the use of createUIEntityFromRecord from store-helpers
 */
/**
 * Creates a UI exchange response from a Holochain record (synchronous version)
 * Used when status information will be populated separately
 */
const createUIExchangeResponseFromRecord = (record: any): UIExchangeResponse => {
  // Decode the entry data from msgpack format
  const decodedEntry = record.entry?.Present?.entry
    ? (decode(record.entry.Present.entry) as ExchangeResponse)
    : null;

  if (!decodedEntry) {
    throw new Error('Could not decode exchange response entry');
  }

  return {
    actionHash: record.signed_action.hashed.hash as ActionHash,
    entry: decodedEntry, // Now properly decoded
    targetEntityHash: '' as unknown as ActionHash, // Will be populated later using the new function
    responderEntityHash: null,
    proposerPubkey: record.signed_action.hashed.content.author.toString(),
    targetEntityType: 'request' as const, // This should be determined from actual data
    // Status fields - populated with defaults, will be updated from ResponseStatus entries
    status: 'Pending' as ExchangeResponseStatus,
    statusReason: null,
    statusUpdatedAt: (record.signed_action.hashed.content.timestamp / 1000) as any,
    statusUpdatedBy: record.signed_action.hashed.content.author as AgentPubKey,
    isLoading: false,
    lastUpdated: (record.signed_action.hashed.content.timestamp / 1000) as any // Convert microseconds to milliseconds
  };
};

/**
 * Fetches status information for a response and updates the UI entity
 */
const populateResponseStatus = async (
  uiResponse: UIExchangeResponse
): Promise<UIExchangeResponse> => {
  return E.runPromise(
    E.gen(function* () {
      const exchangesService = yield* ExchangesServiceTag;

      try {
        // Get the latest status for this response
        const latestStatusRecord = yield* exchangesService.getResponseLatestStatus(
          uiResponse.actionHash
        );

        if (latestStatusRecord) {
          // The status entry should already be decoded by the service
          const statusEntry = latestStatusRecord.entry;

          if (statusEntry) {
            console.log('🔍 Debug - Status entry:', statusEntry);
            return {
              ...uiResponse,
              status: statusEntry.status,
              statusReason: statusEntry.reason || null,
              statusUpdatedAt: statusEntry.updated_at,
              statusUpdatedBy: statusEntry.updated_by
            };
          } else {
            console.warn('Could not get status entry for response:', uiResponse.actionHash);
          }
        } else {
          console.warn('No status record found for response:', uiResponse.actionHash);
        }

        // If no status found or decoding failed, return with default pending status
        console.log('🔍 Debug - Using default pending status for response:', uiResponse.actionHash);
        return uiResponse;
      } catch (error) {
        console.warn('Could not fetch status for response:', uiResponse.actionHash, error);
        return uiResponse;
      }
    }).pipe(E.provide(ExchangesServiceLive), E.provide(HolochainClientLive))
  );
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

export const createExchangesStore = () => {
  // ============================================================================
  // REACTIVE STATE
  // ============================================================================

  // Responses state
  let responses = $state<UIExchangeResponse[]>([]);
  const responsesByStatus = $state<{ [key in ExchangeResponseStatus]: UIExchangeResponse[] }>({
    Pending: [],
    Approved: [],
    Rejected: []
  });

  // Agreements state
  let agreements = $state<UIAgreement[]>([]);
  const agreementsByStatus = $state<{ [key in AgreementStatus]: UIAgreement[] }>({
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
    setLoading: (loading: boolean) => {
      isLoadingResponses = loading;
    },
    setError: (error: string | null) => {
      responsesError = error
        ? ExchangeError.fromError(new Error(error), EXCHANGE_CONTEXTS.RESPONSES_FETCH)
        : null;
    }
  };

  const agreementsSetters: LoadingStateSetter = {
    setLoading: (loading: boolean) => {
      isLoadingAgreements = loading;
    },
    setError: (error: string | null) => {
      agreementsError = error
        ? ExchangeError.fromError(new Error(error), EXCHANGE_CONTEXTS.AGREEMENTS_FETCH)
        : null;
    }
  };

  const reviewsSetters: LoadingStateSetter = {
    setLoading: (loading: boolean) => {
      isLoadingReviews = loading;
    },
    setError: (error: string | null) => {
      reviewsError = error
        ? ExchangeError.fromError(new Error(error), EXCHANGE_CONTEXTS.REVIEWS_FETCH)
        : null;
    }
  };

  const statisticsSetters: LoadingStateSetter = {
    setLoading: (loading: boolean) => {
      isLoadingStatistics = loading;
    },
    setError: (error: string | null) => {
      statisticsError = error
        ? ExchangeError.fromError(new Error(error), EXCHANGE_CONTEXTS.REVIEW_STATISTICS)
        : null;
    }
  };

  // Status helper functions
  const updateResponsesByStatus = () => {
    responsesByStatus.Pending = responses.filter((r) => r.status === 'Pending');
    responsesByStatus.Approved = responses.filter((r) => r.status === 'Approved');
    responsesByStatus.Rejected = responses.filter((r) => r.status === 'Rejected');
  };

  const updateAgreementsByStatus = () => {
    agreementsByStatus.Active = agreements.filter((a) => a.entry.status === 'Active');
    agreementsByStatus.Completed = agreements.filter((a) => a.entry.status === 'Completed');
  };

  // ============================================================================
  // EVENT EMITTERS (for future use)
  // ============================================================================

  const responseEventEmitters =
    createStandardEventEmitters<UIExchangeResponse>('exchange-response');
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

          // Fetch both outgoing responses (created by me) and incoming responses (received by me)
          const [outgoingRecords, incomingRecords] = yield* E.all([
            exchangesService.getMyResponses(),
            exchangesService.getResponsesReceivedByMe()
          ]);

          console.log('🔍 Debug - Raw exchange records:', {
            outgoingRecords: outgoingRecords.length,
            incomingRecords: incomingRecords.length
          });

          // Transform outgoing records using standardized pattern
          const outgoingResponses: UIExchangeResponse[] = [];
          for (const record of outgoingRecords) {
            // Filter for valid records with Present entry structure
            if (
              record &&
              record.signed_action &&
              record.signed_action.hashed &&
              record.entry &&
              (record.entry as any).Present &&
              (record.entry as any).Present.entry
            ) {
              const uiResponse = createUIExchangeResponseFromRecord(record as any);
              if (uiResponse) {
                outgoingResponses.push(uiResponse);
              }
            }
          }

          // Transform incoming records using standardized pattern
          const incomingResponses: UIExchangeResponse[] = [];
          for (const record of incomingRecords) {
            // Filter for valid records with Present entry structure
            if (
              record &&
              record.signed_action &&
              record.signed_action.hashed &&
              record.entry &&
              (record.entry as any).Present &&
              (record.entry as any).Present.entry
            ) {
              const uiResponse = createUIExchangeResponseFromRecord(record as any);
              if (uiResponse) {
                incomingResponses.push(uiResponse);
              }
            }
          }

          // Combine both types of responses
          const allResponses = [...outgoingResponses, ...incomingResponses];

          // Remove duplicates based on actionHash (in case there are any)
          const uniqueResponses = allResponses.filter(
            (response, index, self) =>
              index === self.findIndex((r) => r.actionHash === response.actionHash)
          );

          // Populate status information for all responses
          const responsesWithStatus: UIExchangeResponse[] = [];
          for (const response of uniqueResponses) {
            try {
              const responseWithStatus = yield* E.tryPromise(() =>
                populateResponseStatus(response)
              );
              responsesWithStatus.push(responseWithStatus);
            } catch (error) {
              console.warn('Could not populate status for response:', response.actionHash, error);
              responsesWithStatus.push(response);
            }
          }

          console.log('✅ Final transformed responses with status:', {
            outgoing: outgoingResponses.length,
            incoming: incomingResponses.length,
            combined: allResponses.length,
            unique: uniqueResponses.length,
            withStatus: responsesWithStatus.length
          });

          responses = responsesWithStatus;
          updateResponsesByStatus();
          return responsesWithStatus;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) =>
          E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH))
        )
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
            awaitingCompletion:
              record.entry.status === 'Active' &&
              (!record.entry.provider_completed || !record.entry.receiver_completed)
          }));

          agreements = uiAgreements;
          updateAgreementsByStatus();
          return uiAgreements;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive),
        E.catchAll((error) =>
          E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.AGREEMENTS_FETCH))
        )
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
        E.catchAll((error) =>
          E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.REVIEWS_FETCH))
        )
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
        E.catchAll((error) =>
          E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.REVIEW_STATISTICS))
        )
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
        E.catchAll((error) =>
          E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSE_CREATION))
        )
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
        E.catchAll((error) =>
          E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSE_UPDATE))
        )
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
        E.catchAll((error) =>
          E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.AGREEMENT_CREATION))
        )
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
        E.catchAll((error) =>
          E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.AGREEMENT_COMPLETION))
        )
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
        E.catchAll((error) =>
          E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.REVIEW_CREATION))
        )
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
  // USER-SPECIFIC FUNCTIONS
  // ============================================================================

  /**
   * Check if the current user has already made a response for a specific entity
   * @param entityHash - The hash of the request or offer
   * @param currentUserPubkey - The current user's public key
   * @returns Promise<UIExchangeResponse | null> - The user's response if it exists, null otherwise
   */
  const getUserResponseForEntity = (entityHash: ActionHash, currentUserPubkey: string) =>
    pipe(
      E.gen(function* () {
        const exchangesService = yield* ExchangesServiceTag;

        // Get all responses for this entity
        const entityResponses = yield* exchangesService.getResponsesForEntity(entityHash);

        // Get user's responses
        const userResponses = yield* exchangesService.getMyResponses();

        // Find intersection - responses that are both for this entity AND by this user
        const userResponseForEntity = entityResponses.find((entityResponse) => {
          return userResponses.some((userResponse) => {
            return (
              entityResponse?.signed_action?.hashed?.hash &&
              userResponse?.signed_action?.hashed?.hash &&
              entityResponse.signed_action.hashed.hash.toString() ===
                userResponse.signed_action.hashed.hash.toString()
            );
          });
        });

        if (userResponseForEntity) {
          return createUIExchangeResponseFromRecord(userResponseForEntity as any);
        }

        return null;
      }),
      E.provide(ExchangesServiceLive),
      E.provide(HolochainClientLive),
      E.catchAll((error) =>
        E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH))
      )
    );

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
    fetchResponses, // Fetches both outgoing and incoming responses for the user
    fetchAllResponses: () =>
      withLoadingState(() =>
        pipe(
          E.gen(function* () {
            const exchangesService = yield* ExchangesServiceTag;
            const records = yield* exchangesService.getAllResponses();

            // Transform records using standardized pattern
            const uiResponses: UIExchangeResponse[] = [];
            for (const record of records) {
              if (
                record &&
                record.signed_action &&
                record.signed_action.hashed &&
                record.entry &&
                (record.entry as any).Present &&
                (record.entry as any).Present.entry
              ) {
                const uiResponse = createUIExchangeResponseFromRecord(record as any);
                if (uiResponse) {
                  uiResponses.push(uiResponse);
                }
              }
            }

            // Populate status information for all responses
            const responsesWithStatus: UIExchangeResponse[] = [];
            for (const response of uiResponses) {
              try {
                const responseWithStatus = yield* E.tryPromise(() =>
                  populateResponseStatus(response)
                );
                responsesWithStatus.push(responseWithStatus);
              } catch (error) {
                console.warn('Could not populate status for response:', response.actionHash, error);
                responsesWithStatus.push(response);
              }
            }

            // Update state
            responses = responsesWithStatus;
            updateResponsesByStatus();
            return responsesWithStatus;
          }),
          E.provide(ExchangesServiceLive),
          E.provide(HolochainClientLive),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH))
          )
        )
      ),
    fetchResponsesForEntity: (entityHash: ActionHash) =>
      withLoadingState(() =>
        pipe(
          E.gen(function* () {
            const exchangesService = yield* ExchangesServiceTag;
            const records = yield* exchangesService.getResponsesForEntity(entityHash);

            // Transform records using same pattern as requests
            const uiResponses: UIExchangeResponse[] = records
              .filter(
                (record) =>
                  record &&
                  record.signed_action &&
                  record.signed_action.hashed &&
                  record.entry &&
                  (record.entry as any).Present &&
                  (record.entry as any).Present.entry
              )
              .map((record) => {
                const uiResponse = createUIExchangeResponseFromRecord(record as any);
                return {
                  ...uiResponse,
                  targetEntityHash: entityHash // Set the specific entity hash
                };
              });

            // Populate status information for all responses
            const responsesWithStatus: UIExchangeResponse[] = [];
            for (const response of uiResponses) {
              try {
                const responseWithStatus = yield* E.tryPromise(() =>
                  populateResponseStatus(response)
                );
                responsesWithStatus.push(responseWithStatus);
              } catch (error) {
                console.warn('Could not populate status for response:', response.actionHash, error);
                responsesWithStatus.push(response);
              }
            }

            return responsesWithStatus;
          }),
          E.provide(ExchangesServiceLive),
          E.provide(HolochainClientLive),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH))
          )
        )
      ),
    fetchMyResponses: () =>
      withLoadingState(() =>
        pipe(
          E.gen(function* () {
            const exchangesService = yield* ExchangesServiceTag;
            const records = yield* exchangesService.getMyResponses();

            // Transform records using standardized pattern
            const uiResponses: UIExchangeResponse[] = [];
            for (const record of records) {
              if (
                record &&
                record.signed_action &&
                record.signed_action.hashed &&
                record.entry &&
                (record.entry as any).Present &&
                (record.entry as any).Present.entry
              ) {
                const uiResponse = createUIExchangeResponseFromRecord(record as any);
                if (uiResponse) {
                  uiResponses.push(uiResponse);
                }
              }
            }

            // Populate status information for all responses
            const responsesWithStatus: UIExchangeResponse[] = [];
            for (const response of uiResponses) {
              try {
                const responseWithStatus = yield* E.tryPromise(() =>
                  populateResponseStatus(response)
                );
                responsesWithStatus.push(responseWithStatus);
              } catch (error) {
                console.warn('Could not populate status for response:', response.actionHash, error);
                responsesWithStatus.push(response);
              }
            }

            return responsesWithStatus;
          }),
          E.provide(ExchangesServiceLive),
          E.provide(HolochainClientLive),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH))
          )
        )
      ),
    fetchOutgoingResponses: () =>
      withLoadingState(() =>
        pipe(
          E.gen(function* () {
            const exchangesService = yield* ExchangesServiceTag;
            const records = yield* exchangesService.getMyResponses();

            // Transform records using standardized pattern
            const uiResponses: UIExchangeResponse[] = [];
            for (const record of records) {
              if (
                record &&
                record.signed_action &&
                record.signed_action.hashed &&
                record.entry &&
                (record.entry as any).Present &&
                (record.entry as any).Present.entry
              ) {
                const uiResponse = createUIExchangeResponseFromRecord(record as any);
                if (uiResponse) {
                  uiResponses.push(uiResponse);
                }
              }
            }

            // Populate status information for all responses
            const responsesWithStatus: UIExchangeResponse[] = [];
            for (const response of uiResponses) {
              try {
                const responseWithStatus = yield* E.tryPromise(() =>
                  populateResponseStatus(response)
                );
                responsesWithStatus.push(responseWithStatus);
              } catch (error) {
                console.warn('Could not populate status for response:', response.actionHash, error);
                responsesWithStatus.push(response);
              }
            }

            return responsesWithStatus;
          }),
          E.provide(ExchangesServiceLive),
          E.provide(HolochainClientLive),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH))
          )
        )
      ),
    fetchIncomingResponses: () =>
      withLoadingState(() =>
        pipe(
          E.gen(function* () {
            const exchangesService = yield* ExchangesServiceTag;
            const records = yield* exchangesService.getResponsesReceivedByMe();

            // Transform records using standardized pattern
            const uiResponses: UIExchangeResponse[] = [];
            for (const record of records) {
              if (
                record &&
                record.signed_action &&
                record.signed_action.hashed &&
                record.entry &&
                (record.entry as any).Present &&
                (record.entry as any).Present.entry
              ) {
                const uiResponse = createUIExchangeResponseFromRecord(record as any);
                if (uiResponse) {
                  uiResponses.push(uiResponse);
                }
              }
            }

            // Populate status information for all responses
            const responsesWithStatus: UIExchangeResponse[] = [];
            for (const response of uiResponses) {
              try {
                const responseWithStatus = yield* E.tryPromise(() =>
                  populateResponseStatus(response)
                );
                responsesWithStatus.push(responseWithStatus);
              } catch (error) {
                console.warn('Could not populate status for response:', response.actionHash, error);
                responsesWithStatus.push(response);
              }
            }

            return responsesWithStatus;
          }),
          E.provide(ExchangesServiceLive),
          E.provide(HolochainClientLive),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSES_FETCH))
          )
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

    // User-specific functions
    getUserResponseForEntity,
    getExchangeResponse: (responseHash: ActionHash) =>
      withLoadingState(() =>
        pipe(
          E.gen(function* () {
            const exchangesService = yield* ExchangesServiceTag;
            const record = yield* exchangesService.getExchangeResponse(responseHash);

            if (!record) return null;

            // Transform to UI entity with basic info
            let uiResponse = createUIExchangeResponseFromRecord(record as any);
            if (uiResponse) {
              // Populate status information
              try {
                uiResponse = yield* E.tryPromise(() => populateResponseStatus(uiResponse));
              } catch (error) {
                console.warn('Could not populate status for response:', responseHash, error);
              }

              // Try to find target entity hash by checking existing responses in the store
              // This is a fallback approach since we don't have the target entity directly
              const targetEntityHash = uiResponse.targetEntityHash;

              // If no target entity hash, try to find it in existing responses
              if (!targetEntityHash || targetEntityHash.toString() === '') {
                const existingResponses = responses;
                const matchingResponse = existingResponses.find(
                  (r) =>
                    r.proposerPubkey === uiResponse.proposerPubkey &&
                    r.entry.service_details === uiResponse.entry.service_details
                );
                if (
                  matchingResponse &&
                  matchingResponse.targetEntityHash &&
                  matchingResponse.targetEntityHash.toString() !== ''
                ) {
                  // Create new UI response with updated target entity hash
                  uiResponse = {
                    ...uiResponse,
                    targetEntityHash: matchingResponse.targetEntityHash
                  };
                }
              }

              // Add to cache and state
              const existingIndex = responses.findIndex(
                (r) => r.actionHash.toString() === responseHash.toString()
              );
              if (existingIndex >= 0) {
                responses[existingIndex] = uiResponse;
              } else {
                responses.push(uiResponse);
              }
              updateResponsesByStatus();
            }

            return uiResponse;
          }),
          E.provide(ExchangesServiceLive),
          E.provide(HolochainClientLive),
          E.catchAll((error) =>
            E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPONSE_FETCH))
          )
        )
      )(responsesSetters),

    // Computed properties
    totalExchanges,
    completedExchangesCount
  };
};

// ============================================================================
// STORE INSTANCE
// ============================================================================

/**
 * Main exchanges store instance with all dependencies provided
 * Follows the same pattern as other domain stores in the project
 */
const exchangesStore = createExchangesStore();

export default exchangesStore;
