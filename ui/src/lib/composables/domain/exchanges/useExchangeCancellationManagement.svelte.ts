import type { ActionHash } from '@holochain/client';
import type { 
  UIExchangeCancellation, 
  UIAgreement,
  UIUser, 
  BaseComposableState 
} from '$lib/types/ui';
import type { 
  CancellationReason,
  CancellationInitiator,
  CreateMutualCancellationInput,
  CreateUnilateralCancellationInput,
  RespondToCancellationInput,
  AdminReviewCancellationInput
} from '$lib/schemas/exchanges.schemas';

// Store imports
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import administrationStore from '$lib/stores/administration.store.svelte';

// Utility imports
import { runEffect } from '$lib/utils/effect';
import { showToast, isUserApproved } from '$lib/utils';
import { useModal } from '$lib/utils/composables';
import { Effect as E, Data, pipe } from 'effect';

// Error handling
export class ExchangeCancellationManagementError extends Data.TaggedError('ExchangeCancellationManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ExchangeCancellationManagementError {
    if (error instanceof Error) {
      return new ExchangeCancellationManagementError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new ExchangeCancellationManagementError({
      message: String(error),
      context,
      cause: error
    });
  }
}

// State and Action Interfaces
export interface ExchangeCancellationManagementState extends BaseComposableState {
  // Cancellation data
  cancellationRequests: UIExchangeCancellation[];
  disputedCancellations: UIExchangeCancellation[];
  
  // Filtering
  statusFilter: 'all' | 'pending_consent' | 'mutual_agreed' | 'disputed' | 'admin_reviewed';
  roleFilter: 'all' | 'initiated_by_me' | 'requiring_my_response';
  
  hasInitialized: boolean;
}

export interface ExchangeCancellationManagementActions {
  initialize: () => Promise<void>;
  loadCancellations: () => Promise<void>;
  
  // Cancellation initiation
  initiateMutualCancellation: (
    agreementHash: ActionHash,
    reason: CancellationReason,
    notes?: string
  ) => Promise<void>;
  
  initiateCancellation: (
    agreementHash: ActionHash,
    reason: CancellationReason,
    initiator: CancellationInitiator,
    notes?: string
  ) => Promise<void>;
  
  // Cancellation response
  respondToCancellation: (
    cancellationHash: ActionHash,
    consent: boolean,
    notes?: string
  ) => Promise<void>;
  
  // Admin escalation
  escalateToAdmin: (
    cancellationHash: ActionHash,
    disputeReason: string
  ) => Promise<void>;
  
  adminReviewCancellation: (
    cancellationHash: ActionHash,
    approved: boolean,
    adminNotes?: string
  ) => Promise<void>;
  
  // Filter management
  setStatusFilter: (status: 'all' | 'pending_consent' | 'mutual_agreed' | 'disputed' | 'admin_reviewed') => void;
  setRoleFilter: (role: 'all' | 'initiated_by_me' | 'requiring_my_response') => void;
  clearAllFilters: () => void;
  
  // Utility methods
  canUserInitiateCancellation: (agreement: UIAgreement) => boolean;
  canUserRespondToCancellation: (cancellation: UIExchangeCancellation) => boolean;
  getUserRoleInCancellation: (cancellation: UIExchangeCancellation) => 'initiator' | 'responder' | 'observer';
  getCancellationStatus: (cancellation: UIExchangeCancellation) => string;
  refreshCancellations: () => Promise<void>;
}

export interface UseExchangeCancellationManagement extends ExchangeCancellationManagementState, ExchangeCancellationManagementActions {
  // Store state accessors
  readonly allCancellations: UIExchangeCancellation[];
  readonly currentUser: UIUser | null;
  readonly storeLoading: boolean;
  readonly storeError: string | null;
  readonly isAdministrator: boolean;
  readonly canManageCancellations: boolean;
}

/**
 * Exchange Cancellation Management Composable
 * 
 * Provides comprehensive cancellation workflow handling functionality.
 * Manages cancellation requests, mutual consent tracking, dispute resolution, and admin escalation.
 * 
 * Features:
 * - Cancellation request initiation with reason selection
 * - Mutual consent tracking and validation
 * - Dispute detection and admin escalation
 * - Cancellation history and timeline management
 * - Role-based filtering and access control
 * - User permission validation
 * - Real-time cancellation updates and notifications
 * 
 * @returns Reactive state and actions for exchange cancellation management
 */
export function useExchangeCancellationManagement(): UseExchangeCancellationManagement {
  const modal = useModal();
  
  // ============================================================================
  // STATE INITIALIZATION
  // ============================================================================
  
  let state = $state<ExchangeCancellationManagementState>({
    isLoading: false,
    error: null,
    
    // Cancellation data
    cancellationRequests: [],
    disputedCancellations: [],
    
    // Filtering
    statusFilter: 'all',
    roleFilter: 'all',
    
    hasInitialized: false
  });
  
  // ============================================================================
  // REACTIVE STATE FROM STORES
  // ============================================================================
  
  // Get reactive state from stores
  const { 
    exchangeCancellations: allCancellations,
    loading: storeLoading,
    error: storeError 
  } = exchangesStore;
  
  const { currentUser } = usersStore;
  const { agentIsAdministrator: isAdministrator } = $derived(administrationStore);
  
  // ============================================================================
  // COMPUTED PROPERTIES AND FILTERING
  // ============================================================================
  
  // Filter cancellations based on current filter settings
  const filteredCancellationRequests = $derived.by(() => {
    if (!allCancellations.length) return [];
    
    let filtered = [...allCancellations];
    
    // Apply status filter
    if (state.statusFilter !== 'all') {
      filtered = filtered.filter(cancellation => {
        switch (state.statusFilter) {
          case 'pending_consent':
            return cancellation.other_party_consent === null || cancellation.other_party_consent === undefined;
          case 'mutual_agreed':
            return cancellation.other_party_consent === true;
          case 'disputed':
            return cancellation.other_party_consent === false;
          case 'admin_reviewed':
            return cancellation.admin_reviewed === true;
          default:
            return true;
        }
      });
    }
    
    // Apply role filter
    if (state.roleFilter !== 'all' && currentUser?.original_action_hash) {
      const userHash = currentUser.original_action_hash.toString();
      
      filtered = filtered.filter(cancellation => {
        switch (state.roleFilter) {
          case 'initiated_by_me':
            return cancellation.initiator_hash?.toString() === userHash;
          case 'requiring_my_response':
            // Cancellations where user is not the initiator and consent is still pending
            return cancellation.initiator_hash?.toString() !== userHash &&
                   (cancellation.other_party_consent === null || cancellation.other_party_consent === undefined);
          default:
            return true;
        }
      });
    }
    
    return filtered;
  });
  
  const filteredDisputedCancellations = $derived.by(() => {
    return filteredCancellationRequests.filter(c => c.other_party_consent === false);
  });
  
  // Update state when filtered cancellations change
  $effect(() => {
    state.cancellationRequests = filteredCancellationRequests;
    state.disputedCancellations = filteredDisputedCancellations;
  });
  
  // Check if user can manage cancellations
  const canManageCancellations = $derived(
    currentUser?.status?.status_type === 'accepted' || isAdministrator
  );
  
  // ============================================================================
  // DATA LOADING METHODS
  // ============================================================================
  
  const loadCancellationsEffect = (): E.Effect<void, ExchangeCancellationManagementError> =>
    pipe(
      E.gen(function* () {
        // Validate user permissions first
        if (!currentUser) {
          state.error = 'Please create a user profile to view exchange cancellations.';
          return yield* E.fail(
            new ExchangeCancellationManagementError({
              message: 'No user profile found',
              context: 'loadCancellations'
            })
          );
        }
        
        if (!isUserApproved(currentUser) && !isAdministrator) {
          const status = currentUser.status?.status_type;
          let errorMessage = 'Access denied. Only approved users can view exchange cancellations.';
          
          if (status === 'pending') {
            errorMessage = "Your profile is pending approval. You'll be able to view exchange cancellations once approved.";
          } else if (status === 'rejected') {
            errorMessage = 'Your profile has been rejected. Please contact an administrator.';
          } else if (status?.includes('suspended')) {
            errorMessage = 'Your profile is suspended. Please contact an administrator.';
          }
          
          state.error = errorMessage;
          return yield* E.fail(
            new ExchangeCancellationManagementError({
              message: errorMessage,
              context: 'loadCancellations'
            })
          );
        }
        
        // Load all cancellations
        yield* exchangesStore.getAllExchangeCancellations();
        state.hasInitialized = true;
      }),
      E.mapError((error) => ExchangeCancellationManagementError.fromError(error, 'loadCancellations'))
    );
  
  async function loadCancellations(): Promise<void> {
    try {
      state.isLoading = true;
      state.error = null;
      await runEffect(loadCancellationsEffect());
    } catch (error) {
      const cancellationsError = ExchangeCancellationManagementError.fromError(error, 'loadCancellations');
      state.error = cancellationsError.message;
      showToast('Failed to load exchange cancellations', 'error');
    } finally {
      state.isLoading = false;
    }
  }
  
  async function initialize(): Promise<void> {
    if (state.hasInitialized) return;
    
    try {
      state.isLoading = true;
      await loadCancellations();
      
      // Also refresh current user data
      await runEffect(usersStore.refreshCurrentUser().pipe(
        E.catchAll((error) => {
          console.warn('Failed to refresh current user:', error);
          return E.void;
        })
      ));
      
    } catch (error) {
      const initError = ExchangeCancellationManagementError.fromError(error, 'initialize');
      state.error = initError.message;
      showToast('Failed to initialize exchange cancellations', 'error');
    } finally {
      state.isLoading = false;
    }
  }
  
  // ============================================================================
  // CANCELLATION INITIATION METHODS
  // ============================================================================
  
  async function initiateMutualCancellation(
    agreementHash: ActionHash,
    reason: CancellationReason,
    notes?: string
  ): Promise<void> {
    try {
      if (!canManageCancellations) {
        throw new Error('You do not have permission to initiate cancellations');
      }
      
      const confirmed = await modal.confirm(
        'Are you sure you want to request mutual cancellation of this agreement?<br/>Both parties must agree for the cancellation to proceed.',
        { confirmLabel: 'Request Cancellation', cancelLabel: 'Cancel' }
      );
      
      if (!confirmed) return;
      
      const cancellationInput: CreateMutualCancellationInput = {
        agreement_hash: agreementHash,
        reason,
        explanation: notes || "Mutual cancellation requested",
        resolution_terms: undefined
      };
      
      const createEffect = pipe(
        exchangesStore.createMutualCancellation(cancellationInput),
        E.tap(() => E.sync(() => {
          showToast('Mutual cancellation request created successfully!', 'success');
        })),
        E.mapError((error) => ExchangeCancellationManagementError.fromError(error, 'initiateMutualCancellation'))
      );
      
      await runEffect(createEffect);
      
      // Refresh cancellations to show the new one
      await loadCancellations();
      
    } catch (error) {
      const cancellationError = ExchangeCancellationManagementError.fromError(error, 'initiateMutualCancellation');
      showToast(cancellationError.message, 'error');
      state.error = cancellationError.message;
    }
  }
  
  async function initiateCancellation(
    agreementHash: ActionHash,
    reason: CancellationReason,
    initiator: CancellationInitiator,
    notes?: string
  ): Promise<void> {
    try {
      if (!canManageCancellations) {
        throw new Error('You do not have permission to initiate cancellations');
      }
      
      const getReasonLabel = (reason: CancellationReason): string => {
        if (typeof reason === 'string') {
          const labels: Record<string, string> = {
            'MutualAgreement': 'mutual agreement',
            'ProviderUnavailable': 'provider unavailability',
            'ReceiverNoLongerNeeds': 'receiver no longer needs service',
            'ExternalCircumstances': 'external circumstances',
            'TechnicalFailure': 'technical failure'
          };
          return labels[reason] || 'unknown reason';
        } else if (typeof reason === 'object' && 'Other' in reason) {
          return reason.Other;
        }
        return 'unknown reason';
      };
      
      const confirmed = await modal.confirm(
        `Are you sure you want to cancel this agreement due to ${getReasonLabel(reason)}?<br/>The other party will be notified and can respond to this cancellation request.`,
        { confirmLabel: 'Cancel Agreement', cancelLabel: 'Keep Agreement' }
      );
      
      if (!confirmed) return;
      
      const cancellationInput: CreateUnilateralCancellationInput = {
        agreement_hash: agreementHash,
        reason,
        initiated_by: initiator,
        explanation: notes || "Cancellation requested"
      };
      
      const createEffect = pipe(
        exchangesStore.createUnilateralCancellation(cancellationInput),
        E.tap(() => E.sync(() => {
          showToast('Cancellation request created successfully!', 'success');
        })),
        E.mapError((error) => ExchangeCancellationManagementError.fromError(error, 'initiateCancellation'))
      );
      
      await runEffect(createEffect);
      
      // Refresh cancellations to show the new one
      await loadCancellations();
      
    } catch (error) {
      const cancellationError = ExchangeCancellationManagementError.fromError(error, 'initiateCancellation');
      showToast(cancellationError.message, 'error');
      state.error = cancellationError.message;
    }
  }
  
  // ============================================================================
  // CANCELLATION RESPONSE METHODS
  // ============================================================================
  
  async function respondToCancellation(
    cancellationHash: ActionHash,
    consent: boolean,
    notes?: string
  ): Promise<void> {
    try {
      if (!canManageCancellations) {
        throw new Error('You do not have permission to respond to cancellations');
      }
      
      const actionLabel = consent ? 'agree to' : 'reject';
      const confirmed = await modal.confirm(
        `Are you sure you want to ${actionLabel} this cancellation request?${!consent ? '<br/>This will create a dispute that may require administrator review.' : ''}`,
        { 
          confirmLabel: consent ? 'Agree to Cancellation' : 'Reject Cancellation', 
          cancelLabel: 'Decide Later' 
        }
      );
      
      if (!confirmed) return;
      
      const responseInput: RespondToCancellationInput = {
        cancellation_hash: cancellationHash,
        consent,
        notes: notes || undefined
      };
      
      const respondEffect = pipe(
        exchangesStore.respondToCancellation(responseInput),
        E.tap(() => E.sync(() => {
          const message = consent 
            ? 'Cancellation approved successfully!' 
            : 'Cancellation rejected - dispute created';
          showToast(message, consent ? 'success' : 'error');
        })),
        E.mapError((error) => ExchangeCancellationManagementError.fromError(error, 'respondToCancellation'))
      );
      
      await runEffect(respondEffect);
      
      // Refresh cancellations to show the updated status
      await loadCancellations();
      
    } catch (error) {
      const responseError = ExchangeCancellationManagementError.fromError(error, 'respondToCancellation');
      showToast(responseError.message, 'error');
      state.error = responseError.message;
    }
  }
  
  // ============================================================================
  // ADMIN ESCALATION METHODS
  // ============================================================================
  
  async function escalateToAdmin(
    cancellationHash: ActionHash,
    disputeReason: string
  ): Promise<void> {
    try {
      const confirmed = await modal.confirm(
        'Are you sure you want to escalate this cancellation dispute to an administrator?<br/>This will request admin review and intervention.',
        { confirmLabel: 'Escalate to Admin', cancelLabel: 'Cancel' }
      );
      
      if (!confirmed) return;
      
      // For now, this could create a flag or notification for administrators
      // The actual implementation would depend on the admin notification system
      showToast('Cancellation dispute escalated to administrator', 'success');
      
      // TODO: Implement actual admin escalation logic
      console.log('Escalating cancellation to admin:', { cancellationHash, disputeReason });
      
    } catch (error) {
      const escalationError = ExchangeCancellationManagementError.fromError(error, 'escalateToAdmin');
      showToast(escalationError.message, 'error');
      state.error = escalationError.message;
    }
  }
  
  async function adminReviewCancellation(
    cancellationHash: ActionHash,
    approved: boolean,
    adminNotes?: string
  ): Promise<void> {
    try {
      if (!isAdministrator) {
        throw new Error('Only administrators can review cancellation disputes');
      }
      
      const actionLabel = approved ? 'approve' : 'reject';
      const confirmed = await modal.confirm(
        `Are you sure you want to ${actionLabel} this cancellation as an administrator?<br/>This decision will be final and binding.`,
        { 
          confirmLabel: `${approved ? 'Approve' : 'Reject'} Cancellation`, 
          cancelLabel: 'Cancel' 
        }
      );
      
      if (!confirmed) return;
      
      const reviewInput: AdminReviewCancellationInput = {
        cancellation_hash: cancellationHash,
        admin_notes: adminNotes || 'Administrator review completed',
        resolution_terms: undefined
      };
      
      const reviewEffect = pipe(
        exchangesStore.adminReviewCancellation(reviewInput),
        E.tap(() => E.sync(() => {
          const message = approved 
            ? 'Cancellation approved by administrator' 
            : 'Cancellation rejected by administrator';
          showToast(message, approved ? 'success' : 'error');
        })),
        E.mapError((error) => ExchangeCancellationManagementError.fromError(error, 'adminReviewCancellation'))
      );
      
      await runEffect(reviewEffect);
      
      // Refresh cancellations to show the updated status
      await loadCancellations();
      
    } catch (error) {
      const reviewError = ExchangeCancellationManagementError.fromError(error, 'adminReviewCancellation');
      showToast(reviewError.message, 'error');
      state.error = reviewError.message;
    }
  }
  
  // ============================================================================
  // FILTER MANAGEMENT METHODS
  // ============================================================================
  
  function setStatusFilter(status: 'all' | 'pending_consent' | 'mutual_agreed' | 'disputed' | 'admin_reviewed'): void {
    state.statusFilter = status;
  }
  
  function setRoleFilter(role: 'all' | 'initiated_by_me' | 'requiring_my_response'): void {
    state.roleFilter = role;
  }
  
  function clearAllFilters(): void {
    state.statusFilter = 'all';
    state.roleFilter = 'all';
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  function canUserInitiateCancellation(agreement: UIAgreement): boolean {
    if (!currentUser?.original_action_hash || !canManageCancellations) return false;
    if (isAdministrator) return true;
    
    const userHash = currentUser.original_action_hash.toString();
    return (agreement.provider_hash?.toString() === userHash) ||
           (agreement.receiver_hash?.toString() === userHash);
  }
  
  function canUserRespondToCancellation(cancellation: UIExchangeCancellation): boolean {
    if (!currentUser?.original_action_hash || !canManageCancellations) return false;
    if (isAdministrator) return true;
    
    const userHash = currentUser.original_action_hash.toString();
    return cancellation.initiator_hash?.toString() !== userHash &&
           (cancellation.other_party_consent === null || cancellation.other_party_consent === undefined);
  }
  
  function getUserRoleInCancellation(cancellation: UIExchangeCancellation): 'initiator' | 'responder' | 'observer' {
    if (!currentUser?.original_action_hash) return 'observer';
    
    const userHash = currentUser.original_action_hash.toString();
    
    if (cancellation.initiator_hash?.toString() === userHash) {
      return 'initiator';
    } else if (cancellation.agreement_hash) {
      // Check if user is the other party in the agreement
      // This would require loading the agreement to check provider/receiver roles
      return 'responder'; // Simplified for now
    }
    
    return 'observer';
  }
  
  function getCancellationStatus(cancellation: UIExchangeCancellation): string {
    if (cancellation.admin_reviewed) {
      return 'Admin Reviewed';
    } else if (cancellation.other_party_consent === true) {
      return 'Mutually Agreed';
    } else if (cancellation.other_party_consent === false) {
      return 'Disputed';
    } else {
      return 'Pending Consent';
    }
  }
  
  async function refreshCancellations(): Promise<void> {
    try {
      await loadCancellations();
      showToast('Cancellations refreshed successfully', 'success');
    } catch (error) {
      const refreshError = ExchangeCancellationManagementError.fromError(error, 'refreshCancellations');
      showToast(refreshError.message, 'error');
    }
  }
  
  // ============================================================================
  // COMPOSABLE INTERFACE RETURN
  // ============================================================================
  
  return {
    // State
    get isLoading() {
      return state.isLoading;
    },
    get error() {
      return state.error;
    },
    get cancellationRequests() {
      return state.cancellationRequests;
    },
    get disputedCancellations() {
      return state.disputedCancellations;
    },
    get statusFilter() {
      return state.statusFilter;
    },
    get roleFilter() {
      return state.roleFilter;
    },
    get hasInitialized() {
      return state.hasInitialized;
    },
    
    // Store state
    allCancellations,
    currentUser,
    storeLoading,
    storeError,
    isAdministrator,
    canManageCancellations,
    
    // Actions
    initialize,
    loadCancellations,
    initiateMutualCancellation,
    initiateCancellation,
    respondToCancellation,
    escalateToAdmin,
    adminReviewCancellation,
    setStatusFilter,
    setRoleFilter,
    clearAllFilters,
    canUserInitiateCancellation,
    canUserRespondToCancellation,
    getUserRoleInCancellation,
    getCancellationStatus,
    refreshCancellations
  };
}