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
import usersStore from '$lib/stores/users.store.svelte';
import requestsStore from '$lib/stores/requests.store.svelte';
import offersStore from '$lib/stores/offers.store.svelte';
import { useErrorBoundary } from '$lib/composables/ui/useErrorBoundary.svelte';
import { ExchangeError } from '$lib/errors/exchanges.errors';
import { Effect as E } from 'effect';
import { EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';
import { runEffect } from '$lib/utils/effect';
import {
  HolochainClientLive,
  HolochainClientServiceTag
} from '$lib/services/holochainClient.service';
import { ExchangesServiceTag, ExchangesServiceLive } from '$lib/services/zomes/exchanges.service';

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
  determineUserRole: () => Promise<void>;
  approveResponse: (responseHash: ActionHash, reason?: string) => Promise<void>;
  rejectResponse: (responseHash: ActionHash, reason?: string) => Promise<void>;
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

      await determineUserRole();
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
      // First try to get the specific response directly using Effect.runPromise
      const responseResult = await E.runPromise(exchangesStore.getExchangeResponse(responseHash));

      if (responseResult) {
        // If targetEntityHash is empty, try to fetch it using the new function
        if (!responseResult.targetEntityHash || responseResult.targetEntityHash.toString() === '') {
          try {
            const targetEntityHash = await E.runPromise(
              E.gen(function* () {
                const exchangesService = yield* ExchangesServiceTag;
                return yield* exchangesService.getTargetEntityForResponse(responseHash);
              }).pipe(
                E.provide(ExchangesServiceLive),
                E.provide(HolochainClientLive),
                E.catchAll(() => E.succeed(null))
              )
            );

            if (targetEntityHash) {
              // Create a new response object with the target entity hash
              const updatedResponse = {
                ...responseResult,
                targetEntityHash,
                targetEntityType: 'request' as const // Default, could be improved
              };
              currentResponse = updatedResponse;
            } else {
              currentResponse = responseResult;
            }
          } catch (error) {
            console.warn('Could not fetch target entity hash for response:', error);
            currentResponse = responseResult;
          }
        } else {
          currentResponse = responseResult;
        }

        // Load related response history by fetching all responses and filtering
        await exchangesStore.fetchResponses();
        const allResponses = exchangesStore.responses();
        responseHistory = allResponses.filter(
          (r) =>
            r.targetEntityHash &&
            currentResponse?.targetEntityHash &&
            r.targetEntityHash.toString() === currentResponse.targetEntityHash.toString() &&
            r.actionHash.toString() !== responseHash.toString()
        );
      } else {
        // Try fallback methods - fetch user responses and then all responses
        await exchangesStore.fetchResponses();
        let allResponses = exchangesStore.responses();
        let foundResponse = allResponses.find(
          (r) => r.actionHash.toString() === responseHash.toString()
        );

        // If not found in user responses, try fetching all responses from the system
        if (!foundResponse) {
          await exchangesStore.fetchAllResponses();
          allResponses = exchangesStore.responses();
          foundResponse = allResponses.find(
            (r) => r.actionHash.toString() === responseHash.toString()
          );
        }

        if (foundResponse) {
          currentResponse = foundResponse;
          // Load related response history (same target entity)
          responseHistory = allResponses.filter(
            (r) =>
              r.targetEntityHash &&
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
      let agreement = allAgreements.find(
        (a) => a.actionHash.toString() === agreementHash.toString()
      );

      if (!agreement) {
        // If not found, trigger a refresh
        await exchangesStore.fetchAgreements();
        const refreshedAgreements = exchangesStore.agreements();
        agreement = refreshedAgreements.find(
          (a) => a.actionHash.toString() === agreementHash.toString()
        );
      }

      if (agreement) {
        currentAgreement = agreement;

        // Load related agreement history (same proposal)
        agreementHistory = allAgreements.filter(
          (a) =>
            a.responseHash === agreement.responseHash &&
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

      await determineUserRole();
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

  const determineUserRole = async () => {
    let newRole: typeof userRole = 'observer';
    let newCanApprove = false;
    let newCanReject = false;
    const newCanMarkComplete = false;
    const newCanCreateReview = false;

    const currentUser = usersStore.currentUser;

    if (currentResponse && currentUser?.original_action_hash) {
      try {
        // Get the current agent's public key
        const currentAgentPubKey = await E.runPromise(
          E.gen(function* () {
            const holochainClient = yield* HolochainClientServiceTag;
            const appInfo = yield* holochainClient.getAppInfoEffect();
            return appInfo?.agent_pub_key?.toString() || '';
          }).pipe(
            E.provide(HolochainClientLive),
            E.catchAll(() => E.succeed(''))
          )
        );

        const responseProposerPubkey = currentResponse.proposerPubkey;

        if (responseProposerPubkey === currentAgentPubKey) {
          newRole = 'responder';
        } else {
          // Check if current user is the target entity creator (can approve/reject)
          if (
            currentResponse.targetEntityHash &&
            currentResponse.targetEntityHash.toString() !== ''
          ) {
            // Try to get the target entity to check its creator
            let isTargetEntityCreator = false;

            // First check if it's a request
            const targetRequest = await runEffect(
              requestsStore.getRequest(currentResponse.targetEntityHash)
            );
            if (targetRequest?.creator && currentUser.original_action_hash) {
              isTargetEntityCreator =
                targetRequest.creator.toString() === currentUser.original_action_hash.toString();
            }

            // If not a request, check if it's an offer
            if (!isTargetEntityCreator) {
              const targetOffer = await runEffect(
                offersStore.getOffer(currentResponse.targetEntityHash)
              );
              if (targetOffer?.creator && currentUser.original_action_hash) {
                isTargetEntityCreator =
                  targetOffer.creator.toString() === currentUser.original_action_hash.toString();
              }
            }

            // If current user is the target entity creator, they can approve/reject
            if (isTargetEntityCreator) {
              newRole = 'creator';
              newCanApprove = currentResponse.status === 'Pending';
              newCanReject = currentResponse.status === 'Pending';
            }
          }
        }
      } catch (error) {
        console.warn('Could not determine user role:', error);
      }
    }

    if (currentAgreement && currentUser?.original_action_hash) {
      // TODO: Check provider/receiver roles for agreements
      // This would be implemented when agreement functionality is needed
    }

    userRole = newRole;
    canApproveResponse = newCanApprove;
    canRejectResponse = newCanReject;
    canMarkComplete = newCanMarkComplete;
    canCreateReview = newCanCreateReview;
  };

  const approveResponse = async (responseHash: ActionHash, reason?: string) => {
    try {
      // Update the response status to Approved
      await E.runPromise(
        exchangesStore.updateExchangeResponseStatus({
          response_hash: responseHash,
          new_status: 'Approved',
          reason: reason || null
        })
      );

      // Refresh the current response to show updated status
      if (currentResponse) {
        await loadResponseDetails(responseHash);
        await determineUserRole(); // Update permissions after status change

        // Force refresh the store to ensure UI updates
        await exchangesStore.fetchResponses();
      }
    } catch (error) {
      await errorBoundary.execute(
        E.fail(
          new ExchangeError({
            code: 'UNKNOWN_ERROR',
            message: 'Failed to approve response',
            cause: error,
            details: { responseHash, reason }
          })
        )
      );
    }
  };

  const rejectResponse = async (responseHash: ActionHash, reason?: string) => {
    try {
      // Update the response status to Rejected
      await E.runPromise(
        exchangesStore.updateExchangeResponseStatus({
          response_hash: responseHash,
          new_status: 'Rejected',
          reason: reason || null
        })
      );

      // Refresh the current response to show updated status
      if (currentResponse) {
        await loadResponseDetails(responseHash);
        await determineUserRole(); // Update permissions after status change

        // Force refresh the store to ensure UI updates
        await exchangesStore.fetchResponses();
      }
    } catch (error) {
      await errorBoundary.execute(
        E.fail(
          new ExchangeError({
            code: 'UNKNOWN_ERROR',
            message: 'Failed to reject response',
            cause: error,
            details: { responseHash, reason }
          })
        )
      );
    }
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
    approveResponse,
    rejectResponse,

    // Error handling
    errorBoundary
  };
}
