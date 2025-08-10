import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import { EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';

// Re-export ExchangeError for external use
export { ExchangeError };

import type {
  ExchangeProposal,
  Agreement,
  ExchangeReview,
  ProposalStatus,
  AgreementStatus,
  ProposalType,
  ReviewerType,
  ValidatorRole,
  CreateExchangeProposalInput,
  UpdateProposalStatusInput,
  CreateAgreementInput,
  UpdateAgreementStatusInput,
  MarkCompleteInput,
  CreateReviewInput,
  ExchangeRecordSchema,
  ExchangeRecordOrNullSchema,
  ExchangeRecordsArraySchema,
  VoidResponseSchema
} from '$lib/schemas/exchanges.schemas';

// Re-export simplified types for external use
export type {
  ExchangeProposal,
  Agreement,
  ExchangeReview,
  ProposalStatus,
  AgreementStatus,
  ProposalType,
  ReviewerType,
  ValidatorRole,
  CreateExchangeProposalInput,
  UpdateProposalStatusInput,
  CreateAgreementInput,
  UpdateAgreementStatusInput,
  MarkCompleteInput,
  CreateReviewInput
};

// --- Service Interface ---

// Simplified ExchangesService interface matching the basic exchange workflow
export interface ExchangesService {
  // Exchange Proposal methods - core functionality only
  readonly createExchangeProposal: (
    input: CreateExchangeProposalInput
  ) => E.Effect<Record, ExchangeError>;
  readonly getExchangeProposal: (
    proposalHash: ActionHash
  ) => E.Effect<Record | null, ExchangeError>;
  readonly approveProposal: (
    input: UpdateProposalStatusInput
  ) => E.Effect<ActionHash, ExchangeError>;
  readonly rejectProposal: (
    input: UpdateProposalStatusInput
  ) => E.Effect<ActionHash, ExchangeError>;
  readonly getProposalsForEntity: (entityHash: ActionHash) => E.Effect<Record[], ExchangeError>;
  readonly getMyProposals: () => E.Effect<Record[], ExchangeError>;

  // Agreement methods - simplified workflow
  readonly getAgreement: (agreementHash: ActionHash) => E.Effect<Record | null, ExchangeError>;
  readonly markExchangeComplete: (
    input: MarkCompleteInput
  ) => E.Effect<ActionHash, ExchangeError>;
  readonly getMyExchanges: () => E.Effect<Record[], ExchangeError>;
  readonly getExchangeDetails: (agreementHash: ActionHash) => E.Effect<Record | null, ExchangeError>;

  // Review methods - basic feedback system
  readonly submitReview: (input: CreateReviewInput) => E.Effect<Record, ExchangeError>;
  readonly getReviewsForAgreement: (agreementHash: ActionHash) => E.Effect<Record[], ExchangeError>;
}

export class ExchangesServiceTag extends Context.Tag('ExchangesService')<
  ExchangesServiceTag,
  ExchangesService
>() {}

export const ExchangesServiceLive = Layer.effect(
  ExchangesServiceTag,
  E.gen(function* ($) {
    const holochainClient = yield* $(HolochainClientServiceTag);

    // Exchange Proposal methods
    const createExchangeProposal = (
      input: CreateExchangeProposalInput
    ): E.Effect<Record, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'create_exchange_proposal', input),
        E.map((result) => result as Record),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_EXCHANGE_PROPOSAL));
        })
      );

    const getExchangeProposal = (
      proposalHash: ActionHash
    ): E.Effect<Record | null, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_exchange_proposal', proposalHash),
        E.map((result) => result as Record | null),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_EXCHANGE_PROPOSAL));
        })
      );

    const updateProposalStatus = (
      input: UpdateProposalStatusInput
    ): E.Effect<ActionHash, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'update_proposal_status', input),
        E.map((result) => result as ActionHash),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.UPDATE_PROPOSAL_STATUS));
        })
      );

    const getProposalsForEntity = (entityHash: ActionHash): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_proposals_for_entity', entityHash),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_PROPOSALS_FOR_ENTITY));
        })
      );

    const getProposalsByStatus = (status: ProposalStatus): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_proposals_by_status', status),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_PROPOSALS_BY_STATUS));
        })
      );

    const getAllProposals = (): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_all_proposals', null),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_ALL_PROPOSALS));
        })
      );

    const deleteExchangeProposal = (
      proposalHash: ActionHash
    ): E.Effect<ActionHash, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'delete_exchange_proposal', proposalHash),
        E.map((result) => result as ActionHash),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.DELETE_EXCHANGE_PROPOSAL));
        })
      );

    // Agreement methods
    const createAgreement = (input: CreateAgreementInput): E.Effect<Record, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'create_agreement', input),
        E.map((result) => result as Record),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_AGREEMENT));
        })
      );

    const getAgreement = (agreementHash: ActionHash): E.Effect<Record | null, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_agreement', agreementHash),
        E.map((result) => result as Record | null),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_AGREEMENT));
        })
      );

    const updateAgreementStatus = (
      input: UpdateAgreementStatusInput
    ): E.Effect<ActionHash, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'update_agreement_status', input),
        E.map((result) => result as ActionHash),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.UPDATE_AGREEMENT_STATUS));
        })
      );

    const validateCompletion = (
      input: ValidateCompletionInput
    ): E.Effect<ActionHash, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'validate_completion', input),
        E.map((result) => result as ActionHash),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.VALIDATE_COMPLETION));
        })
      );

    const getAgreementsByStatus = (status: AgreementStatus): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_agreements_by_status', status),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_AGREEMENTS_BY_STATUS));
        })
      );

    const getAllAgreements = (): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_all_agreements', null),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_ALL_AGREEMENTS));
        })
      );

    const getAgreementsForAgent = (agentPubKey: ActionHash): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_agreements_for_agent', agentPubKey),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_AGREEMENTS_FOR_AGENT));
        })
      );

    // Exchange Event methods
    const createExchangeEvent = (
      input: CreateExchangeEventInput
    ): E.Effect<Record, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'create_exchange_event', input),
        E.map((result) => result as Record),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_EXCHANGE_EVENT));
        })
      );

    const getEventsForAgreement = (agreementHash: ActionHash): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_events_for_agreement', agreementHash),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_EVENTS_FOR_AGREEMENT));
        })
      );

    const getAllExchangeEvents = (): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_all_exchange_events', null),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_ALL_EXCHANGE_EVENTS));
        })
      );

    // Exchange Review methods
    const createMutualValidation = (
      input: CreateMutualValidationInput
    ): E.Effect<Record, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'create_mutual_validation', input),
        E.map((result) => result as Record),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_MUTUAL_VALIDATION));
        })
      );

    const createPublicReview = (input: CreatePublicReviewInput): E.Effect<Record, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'create_public_review', input),
        E.map((result) => result as Record),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_PUBLIC_REVIEW));
        })
      );

    const getReviewsForAgreement = (agreementHash: ActionHash): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_reviews_for_agreement', agreementHash),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(
            ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_REVIEWS_FOR_AGREEMENT)
          );
        })
      );

    const getAllExchangeReviews = (): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_all_exchange_reviews', null),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_ALL_EXCHANGE_REVIEWS));
        })
      );

    // Exchange Cancellation methods
    const createMutualCancellation = (
      input: CreateMutualCancellationInput
    ): E.Effect<Record, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'create_mutual_cancellation', input),
        E.map((result) => result as Record),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(
            ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_MUTUAL_CANCELLATION)
          );
        })
      );

    const createUnilateralCancellation = (
      input: CreateUnilateralCancellationInput
    ): E.Effect<Record, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'create_unilateral_cancellation', input),
        E.map((result) => result as Record),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(
            ExchangeError.fromError(error, EXCHANGE_CONTEXTS.CREATE_UNILATERAL_CANCELLATION)
          );
        })
      );

    const respondToCancellation = (
      input: RespondToCancellationInput
    ): E.Effect<ActionHash, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'respond_to_cancellation', input),
        E.map((result) => result as ActionHash),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(ExchangeError.fromError(error, EXCHANGE_CONTEXTS.RESPOND_TO_CANCELLATION));
        })
      );

    const adminReviewCancellation = (
      input: AdminReviewCancellationInput
    ): E.Effect<ActionHash, ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'admin_review_cancellation', input),
        E.map((result) => result as ActionHash),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(
            ExchangeError.fromError(error, EXCHANGE_CONTEXTS.ADMIN_REVIEW_CANCELLATION)
          );
        })
      );

    const getCancellationsForAgreement = (
      agreementHash: ActionHash
    ): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect(
          'exchanges',
          'get_cancellations_for_agreement',
          agreementHash
        ),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(
            ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_CANCELLATIONS_FOR_AGREEMENT)
          );
        })
      );

    const getAllExchangeCancellations = (): E.Effect<Record[], ExchangeError> =>
      pipe(
        holochainClient.callZomeRawEffect('exchanges', 'get_all_exchange_cancellations', null),
        E.map((records) => records as Record[]),
        E.catchAll((error) => {
          if (error instanceof ExchangeError) {
            return E.fail(error);
          }
          return E.fail(
            ExchangeError.fromError(error, EXCHANGE_CONTEXTS.GET_ALL_EXCHANGE_CANCELLATIONS)
          );
        })
      );

    return ExchangesServiceTag.of({
      createExchangeProposal,
      getExchangeProposal,
      updateProposalStatus,
      getProposalsForEntity,
      getProposalsByStatus,
      getAllProposals,
      deleteExchangeProposal,
      createAgreement,
      getAgreement,
      updateAgreementStatus,
      validateCompletion,
      getAgreementsByStatus,
      getAllAgreements,
      getAgreementsForAgent,
      createExchangeEvent,
      getEventsForAgreement,
      getAllExchangeEvents,
      createMutualValidation,
      createPublicReview,
      getReviewsForAgreement,
      getAllExchangeReviews,
      createMutualCancellation,
      createUnilateralCancellation,
      respondToCancellation,
      adminReviewCancellation,
      getCancellationsForAgreement,
      getAllExchangeCancellations
    });
  })
);
