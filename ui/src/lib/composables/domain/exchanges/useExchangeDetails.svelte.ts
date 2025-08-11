import type { ActionHash } from '@holochain/client';
import type { 
  BaseComposableState 
} from '$lib/types/ui';
import type {
  UIExchangeProposal,
  UIAgreement,
  UIExchangeReview,
  ProposalStatus,
  AgreementStatus,
  ValidatorRole,
  ReviewerType
} from '$lib/services/zomes/exchanges.service';

import { createExchangesStore } from '$lib/stores/exchanges.store.svelte';
import { useErrorBoundary } from '$lib/composables/ui/useErrorBoundary.svelte';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import { Effect as E } from 'effect';
import { EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';

export interface ExchangeDetailsState extends BaseComposableState {
  readonly currentProposal: () => UIExchangeProposal | null;
  readonly currentAgreement: () => UIAgreement | null;
  readonly relatedReviews: () => UIExchangeReview[];
  readonly proposalHistory: () => UIExchangeProposal[];
  readonly agreementHistory: () => UIAgreement[];
  readonly canApproveProposal: () => boolean;
  readonly canRejectProposal: () => boolean;
  readonly canMarkComplete: () => boolean;
  readonly canCreateReview: () => boolean;
  readonly userRole: () => 'creator' | 'responder' | 'provider' | 'receiver' | 'observer';
}

export interface ExchangeDetailsActions {
  initialize: (proposalHash?: ActionHash, agreementHash?: ActionHash) => Promise<void>;
  loadProposalDetails: (proposalHash: ActionHash) => Promise<void>;
  loadAgreementDetails: (agreementHash: ActionHash) => Promise<void>;
  loadRelatedReviews: (agreementHash: ActionHash) => Promise<void>;
  refreshDetails: () => Promise<void>;
  determineUserRole: () => void;
}

export interface UseExchangeDetails extends ExchangeDetailsState, ExchangeDetailsActions {
  readonly isLoadingProposal: () => boolean;
  readonly isLoadingAgreement: () => boolean;
  readonly isLoadingReviews: () => boolean;
  readonly proposalError: () => ExchangeError | null;
  readonly agreementError: () => ExchangeError | null;
  readonly reviewsError: () => ExchangeError | null;
  readonly errorBoundary: ReturnType<typeof useErrorBoundary>;
}

/**
 * Composable for managing exchange details view
 * Handles both proposal and agreement details with related data
 */
export function useExchangeDetails(): UseExchangeDetails {
  // ============================================================================
  // STORE AND ERROR HANDLING
  // ============================================================================

  const exchangesStore = createExchangesStore();
  const errorBoundary = useErrorBoundary({
    context: EXCHANGE_CONTEXTS.EXCHANGE_DASHBOARD,
    maxRetries: 3,
    enableLogging: true,
    enableToast: true
  });

  // ============================================================================
  // REACTIVE STATE
  // ============================================================================

  let currentProposal = $state<UIExchangeProposal | null>(null);
  let currentAgreement = $state<UIAgreement | null>(null);
  let relatedReviews = $state<UIExchangeReview[]>([]);
  let proposalHistory = $state<UIExchangeProposal[]>([]);
  let agreementHistory = $state<UIAgreement[]>([]);
  
  // Permission flags
  let canApproveProposal = $state(false);
  let canRejectProposal = $state(false);
  let canMarkComplete = $state(false);
  let canCreateReview = $state(false);
  let userRole = $state<'creator' | 'responder' | 'provider' | 'receiver' | 'observer'>('observer');

  // Loading and error states
  let isLoading = $state(false);

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================

  const isLoadingProposal = () => exchangesStore.isLoadingProposals();
  const isLoadingAgreement = () => exchangesStore.isLoadingAgreements();
  const isLoadingReviews = () => exchangesStore.isLoadingReviews();
  
  const proposalError = () => exchangesStore.proposalsError();
  const agreementError = () => exchangesStore.agreementsError();
  const reviewsError = () => exchangesStore.reviewsError();

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const initialize = async (proposalHash?: ActionHash, agreementHash?: ActionHash) => {
    try {
      isLoading = true;

      if (proposalHash) {
        await loadProposalDetails(proposalHash);
      }

      if (agreementHash) {
        await loadAgreementDetails(agreementHash);
      }

      determineUserRole();
    } catch (error) {
      await errorBoundary.execute(
        E.fail(new ExchangeError({
          code: 'UNKNOWN_ERROR',
          message: 'Failed to initialize exchange details',
          cause: error
        }))
      );
    } finally {
      isLoading = false;
    }
  };

  const loadProposalDetails = async (proposalHash: ActionHash) => {
    try {
      // Find proposal in store or fetch it
      const allProposals = exchangesStore.proposals();
      let proposal = allProposals.find(p => p.actionHash === proposalHash);

      if (!proposal) {
        // If not found, trigger a refresh
        await exchangesStore.fetchProposals();
        const refreshedProposals = exchangesStore.proposals();
        proposal = refreshedProposals.find(p => p.actionHash === proposalHash);
      }

      if (proposal) {
        currentProposal = proposal;
        
        // Load related proposal history (same target entity)
        proposalHistory = allProposals.filter(
          p => p.targetEntityHash === proposal.targetEntityHash && p.actionHash !== proposalHash
        );
      }
    } catch (error) {
      await errorBoundary.execute(
        E.fail(new ExchangeError({
          code: 'PROPOSAL_NOT_FOUND',
          message: 'Failed to load proposal details',
          cause: error,
          details: { proposalHash }
        }))
      );
    }
  };

  const loadAgreementDetails = async (agreementHash: ActionHash) => {
    try {
      // Find agreement in store or fetch it
      const allAgreements = exchangesStore.agreements();
      let agreement = allAgreements.find(a => a.actionHash === agreementHash);

      if (!agreement) {
        // If not found, trigger a refresh
        await exchangesStore.fetchAgreements();
        const refreshedAgreements = exchangesStore.agreements();
        agreement = refreshedAgreements.find(a => a.actionHash === agreementHash);
      }

      if (agreement) {
        currentAgreement = agreement;
        
        // Load related agreement history (same proposal)
        agreementHistory = allAgreements.filter(
          a => a.proposalHash === agreement.proposalHash && a.actionHash !== agreementHash
        );

        // Load related reviews
        await loadRelatedReviews(agreementHash);
      }
    } catch (error) {
      await errorBoundary.execute(
        E.fail(new ExchangeError({
          code: 'AGREEMENT_NOT_FOUND',
          message: 'Failed to load agreement details',
          cause: error,
          details: { agreementHash }
        }))
      );
    }
  };

  const loadRelatedReviews = async (agreementHash: ActionHash) => {
    try {
      // Filter reviews related to this agreement
      const allReviews = exchangesStore.reviews();
      relatedReviews = allReviews.filter(r => r.agreementHash === agreementHash);

      // If no reviews found, trigger a refresh
      if (relatedReviews.length === 0) {
        await exchangesStore.fetchReviews();
        const refreshedReviews = exchangesStore.reviews();
        relatedReviews = refreshedReviews.filter(r => r.agreementHash === agreementHash);
      }
    } catch (error) {
      await errorBoundary.execute(
        E.fail(new ExchangeError({
          code: 'REVIEW_NOT_FOUND',
          message: 'Failed to load related reviews',
          cause: error,
          details: { agreementHash }
        }))
      );
    }
  };

  const refreshDetails = async () => {
    try {
      isLoading = true;

      // Refresh all relevant data
      await Promise.all([
        exchangesStore.fetchProposals(),
        exchangesStore.fetchAgreements(),
        exchangesStore.fetchReviews()
      ]);

      // Re-load current details
      if (currentProposal) {
        await loadProposalDetails(currentProposal.actionHash);
      }

      if (currentAgreement) {
        await loadAgreementDetails(currentAgreement.actionHash);
      }

      determineUserRole();
    } catch (error) {
      await errorBoundary.execute(
        E.fail(new ExchangeError({
          code: 'UNKNOWN_ERROR',
          message: 'Failed to refresh exchange details',
          cause: error
        }))
      );
    } finally {
      isLoading = false;
    }
  };

  const determineUserRole = () => {
    // TODO: Implement user role determination based on current user and exchange context
    // This would check:
    // 1. If user is the original creator of request/offer
    // 2. If user is the responder/proposer
    // 3. If user is provider or receiver in agreement
    // For now, setting as observer

    let newRole: typeof userRole = 'observer';
    let newCanApprove = false;
    let newCanReject = false;
    let newCanMarkComplete = false;
    let newCanCreateReview = false;

    if (currentProposal) {
      // TODO: Check if current user is the target entity creator
      // if (isTargetEntityCreator) {
      //   newRole = 'creator';
      //   newCanApprove = currentProposal.entry.status === 'Pending';
      //   newCanReject = currentProposal.entry.status === 'Pending';
      // }
      
      // TODO: Check if current user is the responder
      // if (isResponder) {
      //   newRole = 'responder';
      // }
    }

    if (currentAgreement) {
      // TODO: Check provider/receiver roles
      // if (isProvider) {
      //   newRole = 'provider';
      //   newCanMarkComplete = !currentAgreement.entry.provider_completed;
      //   newCanCreateReview = currentAgreement.entry.status === 'Completed';
      // }
      
      // if (isReceiver) {
      //   newRole = 'receiver';
      //   newCanMarkComplete = !currentAgreement.entry.receiver_completed;
      //   newCanCreateReview = currentAgreement.entry.status === 'Completed';
      // }
    }

    userRole = newRole;
    canApproveProposal = newCanApprove;
    canRejectProposal = newCanReject;
    canMarkComplete = newCanMarkComplete;
    canCreateReview = newCanCreateReview;
  };

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // State
    currentProposal: () => currentProposal,
    currentAgreement: () => currentAgreement,
    relatedReviews: () => relatedReviews,
    proposalHistory: () => proposalHistory,
    agreementHistory: () => agreementHistory,
    canApproveProposal: () => canApproveProposal,
    canRejectProposal: () => canRejectProposal,
    canMarkComplete: () => canMarkComplete,
    canCreateReview: () => canCreateReview,
    userRole: () => userRole,
    isLoading,
    error: errorBoundary.state.error, // Add missing error property required by BaseComposableState

    // Store state
    isLoadingProposal,
    isLoadingAgreement,
    isLoadingReviews,
    proposalError,
    agreementError,
    reviewsError,

    // Actions
    initialize,
    loadProposalDetails,
    loadAgreementDetails,
    loadRelatedReviews,
    refreshDetails,
    determineUserRole,

    // Error handling
    errorBoundary
  };
}