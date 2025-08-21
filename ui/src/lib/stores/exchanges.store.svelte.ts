import type { ActionHash, Record, AgentPubKey } from '@holochain/client';
import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
import {
  ExchangesServiceTag,
  ExchangesServiceLive,
  type CreateExchangeProposalInput,
  type UpdateProposalStatusInput,
  type CreateAgreementInput,
  type MarkCompleteInput,
  type CreateReviewInput,
  type UIExchangeProposal,
  type UIAgreement,
  type UIExchangeReview,
  type ProposalStatus,
  type AgreementStatus,
  type ReviewerType,
  type ValidatorRole,
  type ReviewStatistics
} from '$lib/services/zomes/exchanges.service';

import { Effect as E, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import { withLoadingState } from '$lib/utils/store-helpers';

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

export const createExchangesStore = () => {
  // ============================================================================
  // REACTIVE STATE
  // ============================================================================

  // Proposals state
  let proposals = $state<UIExchangeProposal[]>([]);
  let proposalsByStatus = $state<{ [key in ProposalStatus]: UIExchangeProposal[] }>({
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
  let isLoadingProposals = $state(false);
  let isLoadingAgreements = $state(false);
  let isLoadingReviews = $state(false);
  let isLoadingStatistics = $state(false);

  // Error states
  let proposalsError = $state<ExchangeError | null>(null);
  let agreementsError = $state<ExchangeError | null>(null);
  let reviewsError = $state<ExchangeError | null>(null);
  let statisticsError = $state<ExchangeError | null>(null);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const setProposalsLoading = (loading: boolean) => {
    isLoadingProposals = loading;
  };
  const setAgreementsLoading = (loading: boolean) => {
    isLoadingAgreements = loading;
  };
  const setReviewsLoading = (loading: boolean) => {
    isLoadingReviews = loading;
  };
  const setStatisticsLoading = (loading: boolean) => {
    isLoadingStatistics = loading;
  };

  const setProposalsError = (error: ExchangeError | null) => {
    proposalsError = error;
  };
  const setAgreementsError = (error: ExchangeError | null) => {
    agreementsError = error;
  };
  const setReviewsError = (error: ExchangeError | null) => {
    reviewsError = error;
  };
  const setStatisticsError = (error: ExchangeError | null) => {
    statisticsError = error;
  };

  const updateProposalsByStatus = () => {
    proposalsByStatus.Pending = proposals.filter((p) => p.entry.status === 'Pending');
    proposalsByStatus.Approved = proposals.filter((p) => p.entry.status === 'Approved');
    proposalsByStatus.Rejected = proposals.filter((p) => p.entry.status === 'Rejected');
  };

  const updateAgreementsByStatus = () => {
    agreementsByStatus.Active = agreements.filter((a) => a.entry.status === 'Active');
    agreementsByStatus.Completed = agreements.filter((a) => a.entry.status === 'Completed');
  };

  // ============================================================================
  // CORE OPERATIONS
  // ============================================================================

  const fetchProposals = () =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const records = yield* exchangesService.getAllProposals();

          // Enhanced transformation with proper mapping
          // Note: linking fields would be populated from separate link queries
          const uiProposals: UIExchangeProposal[] = records.map((record) => ({
            actionHash: record.signed_action.hashed.hash as ActionHash,
            entry: record.entry,
            targetEntityHash: '' as unknown as ActionHash, // TODO: Fetch from links
            responderEntityHash: null, // This would be populated from additional service calls
            proposerPubkey: record.signed_action.hashed.content.author.toString(),
            targetEntityType: 'request' as const, // This should be determined from actual data
            isLoading: false,
            lastUpdated: record.signed_action.hashed.content.timestamp
          }));

          proposals = uiProposals;
          updateProposalsByStatus();

          return uiProposals;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive)
      )
    );

  const fetchAgreements = () =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const records = yield* exchangesService.getAllAgreements();

          // Enhanced transformation with proper mapping
          const uiAgreements: UIAgreement[] = records.map((record) => ({
            actionHash: record.signed_action.hashed.hash as ActionHash,
            entry: record.entry,
            proposalHash: '' as unknown as ActionHash, // TODO: Fetch from links
            targetEntityHash: '' as unknown as ActionHash, // TODO: Fetch from links
            providerPubkey: record.signed_action.hashed.content.author.toString(),
            receiverPubkey: record.signed_action.hashed.content.author.toString(), // This should be determined from proposal
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
        E.provide(HolochainClientLive)
      )
    );

  const fetchReviews = () =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const records = yield* exchangesService.getAllReviews();

          // Enhanced transformation with proper mapping
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
        E.provide(HolochainClientLive)
      )
    );

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
        E.provide(HolochainClientLive)
      )
    );

  // ============================================================================
  // REFRESH HELPERS
  // ============================================================================
  
  const refreshProposals = () =>
    E.gen(function* () {
      const exchangesService = yield* ExchangesServiceTag;
      const records = yield* exchangesService.getAllProposals();
      
      const uiProposals: UIExchangeProposal[] = records.map((record) => ({
        actionHash: record.signed_action.hashed.hash as ActionHash,
        entry: record.entry,
        targetEntityHash: '' as unknown as ActionHash, // TODO: Fetch from links
        responderEntityHash: null,
        proposerPubkey: record.signed_action.hashed.content.author.toString(),
        targetEntityType: 'request' as const,
        isLoading: false,
        lastUpdated: record.signed_action.hashed.content.timestamp
      }));

      proposals = uiProposals;
      updateProposalsByStatus();
      
      return uiProposals;
    });

  const refreshAgreements = () =>
    E.gen(function* () {
      const exchangesService = yield* ExchangesServiceTag;
      const records = yield* exchangesService.getAllAgreements();
      
      const uiAgreements: UIAgreement[] = records.map((record) => ({
        actionHash: record.signed_action.hashed.hash as ActionHash,
        entry: record.entry,
        proposalHash: '' as unknown as ActionHash, // TODO: Fetch from links
        targetEntityHash: '' as unknown as ActionHash, // TODO: Fetch from links
        providerPubkey: record.signed_action.hashed.content.author.toString(),
        receiverPubkey: record.signed_action.hashed.content.author.toString(),
        isLoading: false,
        lastUpdated: record.signed_action.hashed.content.timestamp,
        canMarkComplete: record.entry.status === 'Active',
        awaitingCompletion: record.entry.status === 'Active' && (!record.entry.provider_completed || !record.entry.receiver_completed)
      }));

      agreements = uiAgreements;
      updateAgreementsByStatus();
      
      return uiAgreements;
    });

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  const createProposal = (input: CreateExchangeProposalInput) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const record = yield* exchangesService.createExchangeProposal(input);

          // Refresh proposals after creation
          yield* refreshProposals();

          return record;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive)
      )
    );

  const updateProposalStatus = (input: UpdateProposalStatusInput) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const hash = yield* exchangesService.updateProposalStatus(input);

          // Refresh proposals after update
          yield* refreshProposals();

          return hash;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive)
      )
    );

  const createAgreement = (input: CreateAgreementInput) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const record = yield* exchangesService.createAgreement(input);

          // Refresh agreements after creation
          yield* refreshAgreements();

          return record;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive)
      )
    );

  const markAgreementComplete = (input: MarkCompleteInput) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const hash = yield* exchangesService.markAgreementComplete(input);

          // Refresh agreements after completion
          yield* refreshAgreements();

          return hash;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive)
      )
    );

  const createReview = (input: CreateReviewInput) =>
    withLoadingState(() =>
      pipe(
        E.gen(function* () {
          const exchangesService = yield* ExchangesServiceTag;
          const record = yield* exchangesService.createReview(input);

          // Refresh reviews after creation
          // Since reviews don't have their own refresh function, we'll use the fetch function

          return record;
        }),
        E.provide(ExchangesServiceLive),
        E.provide(HolochainClientLive)
      )
    );

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================

  const pendingProposals = () => proposalsByStatus.Pending;
  const approvedProposals = () => proposalsByStatus.Approved;
  const rejectedProposals = () => proposalsByStatus.Rejected;

  const activeAgreements = () => agreementsByStatus.Active;
  const completedAgreements = () => agreementsByStatus.Completed;

  const totalExchanges = () => proposals.length + agreements.length;
  const completedExchangesCount = () => completedAgreements().length;

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // State getters
    proposals: () => proposals,
    agreements: () => agreements,
    reviews: () => reviews,
    reviewStatistics: () => reviewStatistics,

    // Status-based collections
    pendingProposals,
    approvedProposals,
    rejectedProposals,
    activeAgreements,
    completedAgreements,

    // Loading states
    isLoadingProposals: () => isLoadingProposals,
    isLoadingAgreements: () => isLoadingAgreements,
    isLoadingReviews: () => isLoadingReviews,
    isLoadingStatistics: () => isLoadingStatistics,

    // Error states
    proposalsError: () => proposalsError,
    agreementsError: () => agreementsError,
    reviewsError: () => reviewsError,
    statisticsError: () => statisticsError,

    // Core operations
    fetchProposals,
    fetchAgreements,
    fetchReviews,
    fetchReviewStatistics,

    // CRUD operations
    createProposal,
    updateProposalStatus,
    createAgreement,
    markAgreementComplete,
    createReview,

    // Computed properties
    totalExchanges,
    completedExchangesCount
  };
};
