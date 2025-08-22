import type { ActionHash } from '@holochain/client';
import type { BaseComposableState } from '$lib/types/ui';
import type {
  UIExchangeResponse,
  UIAgreement,
  UIExchangeReview,
  ExchangeResponseStatus,
  AgreementStatus,
  ValidatorRole,
  ReviewerType
} from '$lib/services/zomes/exchanges.service';

import exchangesStore from '$lib/stores/exchanges.store.svelte';
import { useErrorBoundary } from '$lib/composables/ui/useErrorBoundary.svelte';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import { Effect as E } from 'effect';
import { EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';

export interface ExchangeDetailsState extends BaseComposableState {
  readonly currentResponse: () => UIExchangeResponse | null;
  readonly currentAgreement: () => UIAgreement | null;
  readonly relatedReviews: () => UIExchangeReview[];
  readonly responseHistory: () => UIExchangeResponse[];
  readonly agreementHistory: () => UIAgreement[];
  readonly canApproveResponse: () => boolean;
  readonly canRejectResponse: () => boolean;
  readonly canMarkComplete: () => boolean;
  readonly canCreateReview: () => boolean;
  readonly userRole: () => 'creator' | 'responder' | 'provider' | 'receiver' | 'observer';
}

export interface ExchangeDetailsActions {
  initialize: (responseHash?: ActionHash, agreementHash?: ActionHash) => Promise<void>;
  loadResponseDetails: (responseHash: ActionHash) => Promise<void>;
  loadAgreementDetails: (agreementHash: ActionHash) => Promise<void>;
  loadRelatedReviews: (agreementHash: ActionHash) => Promise<void>;
  refreshDetails: () => Promise<void>;
  determineUserRole: () => void;
}

export interface UseExchangeDetails extends ExchangeDetailsState, ExchangeDetailsActions {
  readonly isLoadingResponse: () => boolean;
  readonly isLoadingAgreement: () => boolean;
  readonly isLoadingReviews: () => boolean;
  readonly responseError: () => ExchangeError | null;
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

  const errorBoundary = useErrorBoundary({
    context: EXCHANGE_CONTEXTS.EXCHANGE_DASHBOARD,
    maxRetries: 3,
    enableLogging: true,
    enableToast: true
  });

  // ============================================================================
  // REACTIVE STATE
  // ============================================================================

  let currentResponse = $state<UIExchangeResponse | null>(null);
  let currentAgreement = $state<UIAgreement | null>(null);
  let relatedReviews = $state<UIExchangeReview[]>([]);
  let responseHistory = $state<UIExchangeResponse[]>([]);
  let agreementHistory = $state<UIAgreement[]>([]);

  // Permission flags
  let canApproveResponse = $state(false);
  let canRejectResponse = $state(false);
  let canMarkComplete = $state(false);
  let canCreateReview = $state(false);
  let userRole = $state<'creator' | 'responder' | 'provider' | 'receiver' | 'observer'>('observer');

  // Loading and error states
  let isLoading = $state(false);

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================

  const isLoadingResponse = () => exchangesStore.isLoadingResponses();
  const isLoadingAgreement = () => exchangesStore.isLoadingAgreements();
  const isLoadingReviews = () => exchangesStore.isLoadingReviews();

  const responseError = () => exchangesStore.responsesError();
  const agreementError = () => exchangesStore.agreementsError();
  const reviewsError = () => exchangesStore.reviewsError();

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const initialize = async (responseHash?: ActionHash, agreementHash?: ActionHash) => {
    try {
      isLoading = true;

      if (responseHash) {
        await loadResponseDetails(responseHash);
      }

      if (agreementHash) {
        await loadAgreementDetails(agreementHash);
      }

      determineUserRole();
    } catch (error) {
      await errorBoundary.execute(
        E.fail(
          new ExchangeError({
            code: 'UNKNOWN_ERROR',
            message: 'Failed to initialize exchange details',
            cause: error
          })
        )
      );
    } finally {
      isLoading = false;
    }
  };

  const loadResponseDetails = async (responseHash: ActionHash) => {
    try {
      console.log('🔍 Loading response details for hash:', responseHash.toString());
      
      // First try to get the specific response directly using Effect.runPromise
      const responseResult = await E.runPromise(exchangesStore.getExchangeResponse(responseHash));
      
      console.log('📦 Response result from store:', responseResult);
      
      if (responseResult) {
        currentResponse = responseResult;
        console.log('✅ Successfully set currentResponse:', currentResponse);
        
        // Load related response history by fetching all responses and filtering
        await exchangesStore.fetchResponses();
        const allResponses = exchangesStore.responses();
        responseHistory = allResponses.filter(
          (r) => r.targetEntityHash && 
                 responseResult.targetEntityHash &&
                 r.targetEntityHash.toString() === responseResult.targetEntityHash.toString() &&
                 r.actionHash.toString() !== responseHash.toString()
        );
        console.log('📋 Response history loaded:', responseHistory.length, 'items');
      } else {
        console.log('⚠️ No response result from store, trying fallback methods');
        // Try fallback methods - fetch user responses and then all responses
        await exchangesStore.fetchResponses();
        let allResponses = exchangesStore.responses();
        let foundResponse = allResponses.find((r) => r.actionHash.toString() === responseHash.toString());

        // If not found in user responses, try fetching all responses from the system
        if (!foundResponse) {
          await exchangesStore.fetchAllResponses();
          allResponses = exchangesStore.responses();
          foundResponse = allResponses.find((r) => r.actionHash.toString() === responseHash.toString());
        }
        
        if (foundResponse) {
          currentResponse = foundResponse;
          // Load related response history (same target entity)
          responseHistory = allResponses.filter(
            (r) => r.targetEntityHash && 
                   foundResponse.targetEntityHash &&
                   r.targetEntityHash.toString() === foundResponse.targetEntityHash.toString() &&
                   r.actionHash.toString() !== responseHash.toString()
          );
        } else {
          // Response truly not found
          currentResponse = null;
          responseHistory = [];
        }
      }
    } catch (error) {
      console.error('❌ Error loading response details:', error);
      await errorBoundary.execute(
        E.fail(
          new ExchangeError({
            code: 'TARGET_ENTITY_NOT_FOUND',
            message: 'Failed to load response details',
            cause: error,
            details: { responseHash }
          })
        )
      );
    }
  };

  const loadAgreementDetails = async (agreementHash: ActionHash) => {
    try {
      // Find agreement in store or fetch it
      const allAgreements = exchangesStore.agreements();
      let agreement = allAgreements.find((a) => a.actionHash.toString() === agreementHash.toString());

      if (!agreement) {
        // If not found, trigger a refresh
        await exchangesStore.fetchAgreements();
        const refreshedAgreements = exchangesStore.agreements();
        agreement = refreshedAgreements.find((a) => a.actionHash.toString() === agreementHash.toString());
      }

      if (agreement) {
        currentAgreement = agreement;

        // Load related agreement history (same proposal)
        agreementHistory = allAgreements.filter(
          (a) => a.responseHash === agreement.responseHash && 
                 a.actionHash.toString() !== agreementHash.toString()
        );

        // Load related reviews
        await loadRelatedReviews(agreementHash);
      }
    } catch (error) {
      await errorBoundary.execute(
        E.fail(
          new ExchangeError({
            code: 'AGREEMENT_NOT_FOUND',
            message: 'Failed to load agreement details',
            cause: error,
            details: { agreementHash }
          })
        )
      );
    }
  };

  const loadRelatedReviews = async (agreementHash: ActionHash) => {
    try {
      // Filter reviews related to this agreement
      const allReviews = exchangesStore.reviews();
      relatedReviews = allReviews.filter((r) => r.agreementHash === agreementHash);

      // If no reviews found, trigger a refresh
      if (relatedReviews.length === 0) {
        await exchangesStore.fetchReviews();
        const refreshedReviews = exchangesStore.reviews();
        relatedReviews = refreshedReviews.filter((r) => r.agreementHash === agreementHash);
      }
    } catch (error) {
      await errorBoundary.execute(
        E.fail(
          new ExchangeError({
            code: 'REVIEW_NOT_FOUND',
            message: 'Failed to load related reviews',
            cause: error,
            details: { agreementHash }
          })
        )
      );
    }
  };

  const refreshDetails = async () => {
    try {
      isLoading = true;

      // Refresh all relevant data
      await Promise.all([
        exchangesStore.fetchResponses(),
        exchangesStore.fetchAgreements(),
        exchangesStore.fetchReviews()
      ]);

      // Re-load current details
      if (currentResponse) {
        await loadResponseDetails(currentResponse.actionHash);
      }

      if (currentAgreement) {
        await loadAgreementDetails(currentAgreement.actionHash);
      }

      determineUserRole();
    } catch (error) {
      await errorBoundary.execute(
        E.fail(
          new ExchangeError({
            code: 'UNKNOWN_ERROR',
            message: 'Failed to refresh exchange details',
            cause: error
          })
        )
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

    if (currentResponse) {
      // TODO: Check if current user is the target entity creator
      // if (isTargetEntityCreator) {
      //   newRole = 'creator';
      //   newCanApprove = currentResponse.entry.status === 'Pending';
      //   newCanReject = currentResponse.entry.status === 'Pending';
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
    canApproveResponse = newCanApprove;
    canRejectResponse = newCanReject;
    canMarkComplete = newCanMarkComplete;
    canCreateReview = newCanCreateReview;
  };

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  return {
    // State
    currentResponse: () => currentResponse,
    currentAgreement: () => currentAgreement,
    relatedReviews: () => relatedReviews,
    responseHistory: () => responseHistory,
    agreementHistory: () => agreementHistory,
    canApproveResponse: () => canApproveResponse,
    canRejectResponse: () => canRejectResponse,
    canMarkComplete: () => canMarkComplete,
    canCreateReview: () => canCreateReview,
    userRole: () => userRole,
    isLoading,
    error: errorBoundary.state.error, // Add missing error property required by BaseComposableState

    // Store state
    isLoadingResponse,
    isLoadingAgreement,
    isLoadingReviews,
    responseError,
    agreementError,
    reviewsError,

    // Actions
    initialize,
    loadResponseDetails,
    loadAgreementDetails,
    loadRelatedReviews,
    refreshDetails,
    determineUserRole,

    // Error handling
    errorBoundary
  };
}
