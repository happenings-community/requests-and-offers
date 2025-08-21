import type { ActionHash, Record, AgentPubKey } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe, Schema } from 'effect';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import { EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';

// Re-export ExchangeError for external use
export { ExchangeError };

import type {
  ExchangeResponse,
  Agreement,
  ExchangeReview,
  UIExchangeResponse,
  UIAgreement,
  UIExchangeReview,
  ReviewStatistics,
  CreateExchangeResponseInput,
  UpdateExchangeResponseStatusInput,
  CreateAgreementInput,
  UpdateAgreementStatusInput,
  MarkCompleteInput,
  CreateReviewInput,
  ExchangeResponseStatus,
  AgreementStatus,
  ValidatorRole,
  ReviewerType,
  ExchangeResponseRecord,
  ExchangeResponseRecordOrNull,
  ExchangeResponseRecordsArray,
  AgreementRecord,
  AgreementRecordOrNull,
  AgreementRecordsArray,
  ExchangeReviewRecord,
  ExchangeReviewRecordOrNull,
  ExchangeReviewRecordsArray,
  ExchangesCollection,
  VoidResponse
} from '$lib/schemas/exchanges.schemas';

import {
  ExchangeResponseRecordSchema,
  ExchangeResponseRecordOrNullSchema,
  ExchangeResponseRecordsArraySchema,
  AgreementRecordSchema,
  AgreementRecordOrNullSchema,
  AgreementRecordsArraySchema,
  ExchangeReviewRecordSchema,
  ExchangeReviewRecordOrNullSchema,
  ExchangeReviewRecordsArraySchema,
  VoidResponseSchema
} from '$lib/schemas/exchanges.schemas';

// Re-export types for external use
export type {
  ExchangeResponse,
  Agreement,
  ExchangeReview,
  UIExchangeResponse,
  UIAgreement,
  UIExchangeReview,
  ReviewStatistics,
  CreateExchangeResponseInput,
  UpdateExchangeResponseStatusInput,
  CreateAgreementInput,
  UpdateAgreementStatusInput,
  MarkCompleteInput,
  CreateReviewInput,
  ExchangeResponseStatus,
  AgreementStatus,
  ValidatorRole,
  ReviewerType,
  ExchangeResponseRecord,
  ExchangeResponseRecordOrNull,
  ExchangeResponseRecordsArray,
  AgreementRecord,
  AgreementRecordOrNull,
  AgreementRecordsArray,
  ExchangeReviewRecord,
  ExchangeReviewRecordOrNull,
  ExchangeReviewRecordsArray,
  ExchangesCollection,
  VoidResponse
};

// --- Service Interface ---

export interface ExchangesService {
  // Response methods
  readonly createExchangeResponse: (
    input: CreateExchangeResponseInput
  ) => E.Effect<ExchangeResponseRecord, ExchangeError>;
  readonly getExchangeResponse: (
    responseHash: ActionHash
  ) => E.Effect<ExchangeResponseRecordOrNull, ExchangeError>;
  readonly updateExchangeResponseStatus: (
    input: UpdateExchangeResponseStatusInput
  ) => E.Effect<ActionHash, ExchangeError>;
  readonly deleteExchangeResponse: (
    responseHash: ActionHash
  ) => E.Effect<ActionHash, ExchangeError>;
  readonly getResponsesForEntity: (
    entityHash: ActionHash
  ) => E.Effect<ExchangeResponseRecordsArray, ExchangeError>;
  readonly getResponsesByStatus: (
    status: ExchangeResponseStatus
  ) => E.Effect<ExchangeResponseRecordsArray, ExchangeError>;
  readonly getAllResponses: () => E.Effect<ExchangeResponseRecordsArray, ExchangeError>;
  readonly getResponsesByAgent: (
    agentPubkey: AgentPubKey
  ) => E.Effect<ExchangeResponseRecordsArray, ExchangeError>;
  readonly getMyResponses: () => E.Effect<ExchangeResponseRecordsArray, ExchangeError>;

  // Agreement methods
  readonly createAgreement: (
    input: CreateAgreementInput
  ) => E.Effect<AgreementRecord, ExchangeError>;
  readonly getAgreement: (
    agreementHash: ActionHash
  ) => E.Effect<AgreementRecordOrNull, ExchangeError>;
  readonly updateAgreementStatus: (
    input: UpdateAgreementStatusInput
  ) => E.Effect<ActionHash, ExchangeError>;
  readonly markAgreementComplete: (input: MarkCompleteInput) => E.Effect<ActionHash, ExchangeError>;
  readonly getAgreementsForResponse: (
    responseHash: ActionHash
  ) => E.Effect<AgreementRecordsArray, ExchangeError>;
  readonly getAllAgreements: () => E.Effect<AgreementRecordsArray, ExchangeError>;
  readonly getActiveAgreements: () => E.Effect<AgreementRecordsArray, ExchangeError>;
  readonly getCompletedAgreements: () => E.Effect<AgreementRecordsArray, ExchangeError>;

  // Review methods
  readonly createReview: (
    input: CreateReviewInput
  ) => E.Effect<ExchangeReviewRecord, ExchangeError>;
  readonly getReview: (
    reviewHash: ActionHash
  ) => E.Effect<ExchangeReviewRecordOrNull, ExchangeError>;
  readonly getReviewsForAgreement: (
    agreementHash: ActionHash
  ) => E.Effect<ExchangeReviewRecordsArray, ExchangeError>;
  readonly getAllReviews: () => E.Effect<ExchangeReviewRecordsArray, ExchangeError>;
  readonly getReviewStatistics: (agentPubkey?: string) => E.Effect<ReviewStatistics, ExchangeError>;

  // Utility methods
  readonly getExchangesCollection: () => E.Effect<ExchangesCollection, ExchangeError>;
  readonly getUserExchangeHistory: (
    agentPubkey?: string
  ) => E.Effect<ExchangesCollection, ExchangeError>;
}

// --- Context Tag ---

export const ExchangesServiceTag = Context.GenericTag<ExchangesService>('ExchangesService');

// --- Service Implementation ---

export const makeExchangesService = E.gen(function* () {
  const client = yield* HolochainClientServiceTag;

  // Helper function to handle zome calls with proper error transformation
  const callZome = <T>(
    fnName: string,
    payload: unknown,
    context: string
  ): E.Effect<T, ExchangeError> =>
    pipe(
      client.callZomeRawEffect('exchanges', fnName, payload),
      E.map((result) => result as T),
      E.catchAll((error) => {
        if (error instanceof ExchangeError) {
          return E.fail(error);
        }
        return E.fail(
          new ExchangeError({
            code: 'NETWORK_ERROR',
            message: `${context}: ${error}`,
            cause: error,
            details: { fnName, payload, context }
          })
        );
      })
    );

  // --- Response Methods ---

  const createExchangeResponse = (input: CreateExchangeResponseInput) =>
    callZome<ExchangeResponseRecord>(
      'create_exchange_response',
      input,
      EXCHANGE_CONTEXTS.RESPONSE_CREATION
    );

  const getExchangeResponse = (responseHash: ActionHash) =>
    callZome<ExchangeResponseRecordOrNull>(
      'get_exchange_response',
      responseHash,
      EXCHANGE_CONTEXTS.RESPONSE_FETCH
    );

  const updateExchangeResponseStatus = (input: UpdateExchangeResponseStatusInput) =>
    callZome<ActionHash>('update_response_status', input, EXCHANGE_CONTEXTS.RESPONSE_UPDATE);

  const deleteExchangeResponse = (responseHash: ActionHash) =>
    callZome<ActionHash>(
      'delete_exchange_response',
      responseHash,
      EXCHANGE_CONTEXTS.RESPONSE_DELETION
    );

  const getResponsesForEntity = (entityHash: ActionHash) =>
    callZome<ExchangeResponseRecordsArray>(
      'get_responses_for_entity',
      entityHash,
      EXCHANGE_CONTEXTS.RESPONSES_FETCH
    );

  const getResponsesByStatus = (status: ExchangeResponseStatus) =>
    callZome<ExchangeResponseRecordsArray>(
      'get_responses_by_status',
      status,
      EXCHANGE_CONTEXTS.RESPONSES_FETCH
    );

  const getAllResponses = () =>
    callZome<ExchangeResponseRecordsArray>(
      'get_all_responses',
      null,
      EXCHANGE_CONTEXTS.RESPONSES_FETCH
    );

  const getResponsesByAgent = (agentPubkey: AgentPubKey) =>
    callZome<ExchangeResponseRecordsArray>(
      'get_responses_by_agent',
      agentPubkey,
      EXCHANGE_CONTEXTS.RESPONSES_FETCH
    );

  const getMyResponses = () =>
    callZome<ExchangeResponseRecordsArray>(
      'get_my_responses',
      null,
      EXCHANGE_CONTEXTS.RESPONSES_FETCH
    );

  // --- Agreement Methods ---

  const createAgreement = (input: CreateAgreementInput) =>
    callZome<AgreementRecord>('create_agreement', input, EXCHANGE_CONTEXTS.AGREEMENT_CREATION);

  const getAgreement = (agreementHash: ActionHash) =>
    callZome<AgreementRecordOrNull>(
      'get_agreement',
      agreementHash,
      EXCHANGE_CONTEXTS.AGREEMENT_FETCH
    );

  const updateAgreementStatus = (input: UpdateAgreementStatusInput) =>
    callZome<ActionHash>('update_agreement_status', input, EXCHANGE_CONTEXTS.AGREEMENT_UPDATE);

  const markAgreementComplete = (input: MarkCompleteInput) =>
    callZome<ActionHash>('mark_completion', input, EXCHANGE_CONTEXTS.AGREEMENT_COMPLETION);

  const getAgreementsForResponse = (responseHash: ActionHash) =>
    callZome<AgreementRecordsArray>(
      'get_agreements_for_response',
      responseHash,
      EXCHANGE_CONTEXTS.AGREEMENTS_FETCH
    );

  const getAllAgreements = () =>
    callZome<AgreementRecordsArray>('get_all_agreements', null, EXCHANGE_CONTEXTS.AGREEMENTS_FETCH);

  const getActiveAgreements = () =>
    callZome<AgreementRecordsArray>(
      'get_active_agreements',
      null,
      EXCHANGE_CONTEXTS.AGREEMENTS_FETCH
    );

  const getCompletedAgreements = () =>
    callZome<AgreementRecordsArray>(
      'get_completed_agreements',
      null,
      EXCHANGE_CONTEXTS.AGREEMENTS_FETCH
    );

  // --- Review Methods ---

  const createReview = (input: CreateReviewInput) =>
    callZome<ExchangeReviewRecord>('create_review', input, EXCHANGE_CONTEXTS.REVIEW_CREATION);

  const getReview = (reviewHash: ActionHash) =>
    callZome<ExchangeReviewRecordOrNull>('get_review', reviewHash, EXCHANGE_CONTEXTS.REVIEW_FETCH);

  const getReviewsForAgreement = (agreementHash: ActionHash) =>
    callZome<ExchangeReviewRecordsArray>(
      'get_reviews_for_agreement',
      agreementHash,
      EXCHANGE_CONTEXTS.REVIEWS_FETCH
    );

  const getAllReviews = () =>
    callZome<ExchangeReviewRecordsArray>('get_all_reviews', null, EXCHANGE_CONTEXTS.REVIEWS_FETCH);

  const getReviewStatistics = (agentPubkey?: string) =>
    callZome<ReviewStatistics>(
      'get_review_statistics',
      agentPubkey || null,
      EXCHANGE_CONTEXTS.REVIEW_STATISTICS
    );

  // --- Utility Methods ---

  const getExchangesCollection = (): E.Effect<ExchangesCollection, ExchangeError> =>
    E.gen(function* () {
      const responses = yield* getAllResponses();
      const agreements = yield* getAllAgreements();
      const reviews = yield* getAllReviews();

      // Transform to UI types (this would be implemented with proper mappers)
      return {
        responses: [], // TODO: Transform responses to UIExchangeResponse
        agreements: [], // TODO: Transform agreements to UIAgreement
        reviews: [] // TODO: Transform reviews to UIExchangeReview
      };
    });

  const getUserExchangeHistory = (
    agentPubkey?: string
  ): E.Effect<ExchangesCollection, ExchangeError> =>
    E.gen(function* () {
      // Get user-specific exchanges
      const responses = agentPubkey 
        ? yield* getResponsesByAgent(agentPubkey as unknown as AgentPubKey)
        : yield* getMyResponses();
      
      const agreements = yield* getAllAgreements();
      const reviews = yield* getAllReviews();

      // Transform to UI types (this would be implemented with proper mappers)
      return {
        responses: [], // TODO: Transform responses to UIExchangeResponse
        agreements: [], // TODO: Transform agreements to UIAgreement
        reviews: [] // TODO: Transform reviews to UIExchangeReview
      };
    });

  return {
    // Response methods
    createExchangeResponse,
    getExchangeResponse,
    updateExchangeResponseStatus,
    deleteExchangeResponse,
    getResponsesForEntity,
    getResponsesByStatus,
    getAllResponses,
    getResponsesByAgent,
    getMyResponses,

    // Agreement methods
    createAgreement,
    getAgreement,
    updateAgreementStatus,
    markAgreementComplete,
    getAgreementsForResponse,
    getAllAgreements,
    getActiveAgreements,
    getCompletedAgreements,

    // Review methods
    createReview,
    getReview,
    getReviewsForAgreement,
    getAllReviews,
    getReviewStatistics,

    // Utility methods
    getExchangesCollection,
    getUserExchangeHistory
  };
});

// --- Layer ---

export const ExchangesServiceLayer = Layer.effect(ExchangesServiceTag, makeExchangesService);

// --- Provider Layer ---

export const ExchangesServiceLive = ExchangesServiceLayer;
