import type { ActionHash } from '@holochain/client';
import type { 
  UIAgreement, 
  UIExchangeEvent,
  UIUser, 
  BaseComposableState 
} from '$lib/types/ui';
import type { 
  AgreementStatus, 
  CreateAgreementInput,
  UpdateAgreementStatusInput,
  ValidateCompletionInput,
  CreateExchangeEventInput
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
import { page } from '$app/state';
import { goto } from '$app/navigation';

// Error handling
export class ExchangeAgreementManagementError extends Data.TaggedError('ExchangeAgreementManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ExchangeAgreementManagementError {
    if (error instanceof Error) {
      return new ExchangeAgreementManagementError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new ExchangeAgreementManagementError({
      message: String(error),
      context,
      cause: error
    });
  }
}

// State and Action Interfaces
export interface ExchangeAgreementManagementState extends BaseComposableState {
  filteredAgreements: UIAgreement[];
  statusFilter: AgreementStatus | "all";
  roleFilter: "provider" | "receiver" | "all";
  participantFilter: "all" | "my" | "involving_me";
  hasInitialized: boolean;
}

export interface ExchangeAgreementManagementActions {
  initialize: () => Promise<void>;
  loadAgreements: () => Promise<void>;
  
  // Agreement creation and management
  createAgreementFromProposal: (proposalHash: ActionHash, agreedTerms?: string) => Promise<void>;
  updateAgreementStatus: (
    agreementHash: ActionHash,
    newStatus: AgreementStatus
  ) => Promise<void>;
  
  // Progress and milestone management
  addProgressUpdate: (
    agreementHash: ActionHash,
    update: Omit<CreateExchangeEventInput, "agreement_hash">
  ) => Promise<void>;
  
  // Completion validation workflow
  validateCompletion: (
    agreementHash: ActionHash,
    validation: Omit<ValidateCompletionInput, "agreement_hash">
  ) => Promise<void>;
  
  // Filter management
  setStatusFilter: (status: AgreementStatus | "all") => void;
  setRoleFilter: (role: "provider" | "receiver" | "all") => void;
  setParticipantFilter: (filter: "all" | "my" | "involving_me") => void;
  clearAllFilters: () => void;
  
  // Utility methods
  canUserManageAgreement: (agreement: UIAgreement) => boolean;
  getUserRoleInAgreement: (agreement: UIAgreement) => "provider" | "receiver" | "none";
  getAgreementEvents: (agreementHash: ActionHash) => Promise<UIExchangeEvent[]>;
  refreshAgreements: () => Promise<void>;
}

export interface UseExchangeAgreementManagement extends ExchangeAgreementManagementState, ExchangeAgreementManagementActions {
  // Store state accessors
  readonly agreements: UIAgreement[];
  readonly activeAgreements: UIAgreement[];
  readonly inProgressAgreements: UIAgreement[];
  readonly completedAgreements: UIAgreement[];
  readonly cancelledAgreements: UIAgreement[];
  readonly disputedAgreements: UIAgreement[];
  readonly storeLoading: boolean;
  readonly storeError: string | null;
  readonly currentUser: UIUser | null;
  readonly canManageAgreements: boolean;
}

/**
 * Exchange Agreement Management Composable
 * 
 * Provides comprehensive agreement workflow orchestration functionality.
 * Handles agreement formation, status transitions, progress tracking, and mutual validation.
 * 
 * Features:
 * - Agreement formation from accepted proposals
 * - Agreement status transitions and tracking
 * - Progress monitoring and milestone management
 * - Mutual validation workflow coordination
 * - Role-based filtering (provider/receiver)
 * - User permission validation
 * - Real-time agreement updates and notifications
 * 
 * @returns Reactive state and actions for exchange agreement management
 */
export function useExchangeAgreementManagement(): UseExchangeAgreementManagement {
  const modal = useModal();
  
  // ============================================================================
  // STATE INITIALIZATION
  // ============================================================================
  
  // Initialize filter type from URL parameters
  const getInitialStatusFilter = (): AgreementStatus | "all" => {
    if (!page.url) return 'all';
    const statusParam = page.url.searchParams.get('status');
    const validStatuses: AgreementStatus[] = [
      'Active', 'InProgress', 'Completed', 'CancelledMutual', 
      'CancelledProvider', 'CancelledReceiver', 'Failed', 'Disputed'
    ];
    if (validStatuses.includes(statusParam as AgreementStatus)) {
      return statusParam as AgreementStatus;
    }
    return 'all';
  };
  
  const getInitialRoleFilter = (): "provider" | "receiver" | "all" => {
    if (!page.url) return 'all';
    const roleParam = page.url.searchParams.get('role');
    if (roleParam === 'provider' || roleParam === 'receiver') {
      return roleParam;
    }
    return 'all';
  };
  
  let state = $state<ExchangeAgreementManagementState>({
    isLoading: false,
    error: null,
    filteredAgreements: [],
    statusFilter: getInitialStatusFilter(),
    roleFilter: getInitialRoleFilter(), 
    participantFilter: 'all',
    hasInitialized: false
  });
  
  // Track programmatic filter changes to avoid URL conflicts
  let isChangingFilterProgrammatically = false;
  
  // ============================================================================
  // REACTIVE STATE FROM STORES
  // ============================================================================
  
  // Get reactive state from stores
  const { 
    agreements,
    activeAgreements,
    inProgressAgreements, 
    completedAgreements,
    cancelledAgreements,
    disputedAgreements,
    loading: storeLoading,
    error: storeError 
  } = exchangesStore;
  
  const { currentUser } = usersStore;
  const { agentIsAdministrator } = $derived(administrationStore);
  
  // ============================================================================
  // URL PARAMETER SYNCHRONIZATION
  // ============================================================================
  
  // Handle URL parameter changes (only when not changing programmatically)
  $effect(() => {
    if (!page.url || isChangingFilterProgrammatically) return;
    
    const statusParam = page.url.searchParams.get('status');
    const roleParam = page.url.searchParams.get('role');
    
    // Update status filter from URL
    const validStatuses: AgreementStatus[] = [
      'Active', 'InProgress', 'Completed', 'CancelledMutual', 
      'CancelledProvider', 'CancelledReceiver', 'Failed', 'Disputed'
    ];
    if (validStatuses.includes(statusParam as AgreementStatus)) {
      if (state.statusFilter !== statusParam) {
        state.statusFilter = statusParam as AgreementStatus;
      }
    } else if (statusParam === null && state.statusFilter !== 'all') {
      state.statusFilter = 'all';
    }
    
    // Update role filter from URL
    if (roleParam === 'provider' || roleParam === 'receiver') {
      if (state.roleFilter !== roleParam) {
        state.roleFilter = roleParam;
      }
    } else if (roleParam === null && state.roleFilter !== 'all') {
      state.roleFilter = 'all';
    }
  });
  
  // ============================================================================
  // COMPUTED PROPERTIES AND FILTERING
  // ============================================================================
  
  // Filter agreements based on current filter settings
  const filteredAgreements = $derived.by(() => {
    if (!agreements.length) return [];
    
    let filtered = [...agreements];
    
    // Apply status filter
    if (state.statusFilter !== 'all') {
      filtered = filtered.filter(agreement => agreement.status === state.statusFilter);
    }
    
    // Apply role and participant filters
    if (currentUser?.original_action_hash) {
      const userHash = currentUser.original_action_hash.toString();
      
      // Apply role filter
      if (state.roleFilter !== 'all') {
        filtered = filtered.filter(agreement => {
          if (state.roleFilter === 'provider') {
            return agreement.provider_hash?.toString() === userHash;
          } else if (state.roleFilter === 'receiver') {
            return agreement.receiver_hash?.toString() === userHash;
          }
          return true;
        });
      }
      
      // Apply participant filter
      switch (state.participantFilter) {
        case 'my':
          // Agreements created by current user (who initiated the proposal)
          filtered = filtered.filter(agreement => 
            agreement.creator && agreement.creator.toString() === userHash
          );
          break;
        case 'involving_me':
          // Agreements where current user is either provider or receiver
          filtered = filtered.filter(agreement => 
            (agreement.provider_hash?.toString() === userHash) ||
            (agreement.receiver_hash?.toString() === userHash)
          );
          break;
      }
    }
    
    return filtered;
  });
  
  // Update state when filtered agreements change
  $effect(() => {
    state.filteredAgreements = filteredAgreements;
  });
  
  // Check if user can manage agreements
  const canManageAgreements = $derived(
    currentUser?.status?.status_type === 'accepted' || agentIsAdministrator
  );
  
  // ============================================================================
  // DATA LOADING METHODS
  // ============================================================================
  
  const loadAgreementsEffect = (): E.Effect<void, ExchangeAgreementManagementError> =>
    pipe(
      E.gen(function* () {
        // Validate user permissions first
        if (!currentUser) {
          state.error = 'Please create a user profile to view exchange agreements.';
          return yield* E.fail(
            new ExchangeAgreementManagementError({
              message: 'No user profile found',
              context: 'loadAgreements'
            })
          );
        }
        
        if (!isUserApproved(currentUser) && !agentIsAdministrator) {
          const status = currentUser.status?.status_type;
          let errorMessage = 'Access denied. Only approved users can view exchange agreements.';
          
          if (status === 'pending') {
            errorMessage = "Your profile is pending approval. You'll be able to view exchange agreements once approved.";
          } else if (status === 'rejected') {
            errorMessage = 'Your profile has been rejected. Please contact an administrator.';
          } else if (status?.includes('suspended')) {
            errorMessage = 'Your profile is suspended. Please contact an administrator.';
          }
          
          state.error = errorMessage;
          return yield* E.fail(
            new ExchangeAgreementManagementError({
              message: errorMessage,
              context: 'loadAgreements'
            })
          );
        }
        
        // Load all agreements
        yield* exchangesStore.getAllAgreements();
        state.hasInitialized = true;
      }),
      E.mapError((error) => ExchangeAgreementManagementError.fromError(error, 'loadAgreements'))
    );
  
  async function loadAgreements(): Promise<void> {
    try {
      state.isLoading = true;
      state.error = null;
      await runEffect(loadAgreementsEffect());
    } catch (error) {
      const agreementsError = ExchangeAgreementManagementError.fromError(error, 'loadAgreements');
      state.error = agreementsError.message;
      showToast('Failed to load exchange agreements', 'error');
    } finally {
      state.isLoading = false;
    }
  }
  
  async function initialize(): Promise<void> {
    if (state.hasInitialized) return;
    
    try {
      state.isLoading = true;
      await loadAgreements();
      
      // Also refresh current user data
      await runEffect(usersStore.refreshCurrentUser().pipe(
        E.catchAll((error) => {
          console.warn('Failed to refresh current user:', error);
          return E.void;
        })
      ));
      
    } catch (error) {
      const initError = ExchangeAgreementManagementError.fromError(error, 'initialize');
      state.error = initError.message;
      showToast('Failed to initialize exchange agreements', 'error');
    } finally {
      state.isLoading = false;
    }
  }
  
  // ============================================================================
  // AGREEMENT CREATION AND MANAGEMENT METHODS
  // ============================================================================
  
  async function createAgreementFromProposal(proposalHash: ActionHash, agreedTerms?: string): Promise<void> {
    try {
      if (!canManageAgreements) {
        throw new Error('You do not have permission to create agreements');
      }
      
      if (!currentUser?.original_action_hash) {
        throw new Error('User profile not found');
      }
      
      const confirmed = await modal.confirm(
        'Are you sure you want to create an agreement from this proposal?<br/>This will create a binding agreement between both parties.',
        { confirmLabel: 'Create Agreement', cancelLabel: 'Cancel' }
      );
      
      if (!confirmed) return;
      
      // TODO: In a real implementation, we would need to get these details from the proposal
      // For now, using placeholder values that match the required schema
      const agreementInput: CreateAgreementInput = {
        proposal_hash: proposalHash,
        service_details: "Service details from proposal", // Required field
        agreed_terms: agreedTerms || "Standard terms as discussed in proposal",
        exchange_medium: "To be determined", // Required field
        exchange_value: undefined,
        delivery_timeframe: undefined,
        additional_conditions: undefined,
        start_date: undefined,
        completion_date: undefined
      };
      
      const createEffect = pipe(
        exchangesStore.createAgreement(agreementInput),
        E.tap(() => E.sync(() => {
          showToast('Agreement created successfully!', 'success');
        })),
        E.mapError((error) => ExchangeAgreementManagementError.fromError(error, 'createAgreementFromProposal'))
      );
      
      await runEffect(createEffect);
      
      // Refresh agreements to show the new one
      await loadAgreements();
      
    } catch (error) {
      const agreementError = ExchangeAgreementManagementError.fromError(error, 'createAgreementFromProposal');
      showToast(agreementError.message, 'error');
      state.error = agreementError.message;
    }
  }
  
  async function updateAgreementStatus(
    agreementHash: ActionHash,
    newStatus: AgreementStatus
  ): Promise<void> {
    try {
      if (!canManageAgreements) {
        throw new Error('You do not have permission to update agreement status');
      }
      
      const statusLabels: Record<AgreementStatus, string> = {
        'Active': 'activate',
        'InProgress': 'mark as in progress',
        'Completed': 'mark as completed',
        'CancelledMutual': 'cancel (mutual)',
        'CancelledProvider': 'cancel (provider)',
        'CancelledReceiver': 'cancel (receiver)',
        'Failed': 'mark as failed',
        'Disputed': 'mark as disputed'
      };
      
      const confirmed = await modal.confirm(
        `Are you sure you want to ${statusLabels[newStatus]} this agreement?`,
        { confirmLabel: 'Update', cancelLabel: 'Cancel' }
      );
      
      if (!confirmed) return;
      
      const updateInput: UpdateAgreementStatusInput = {
        agreement_hash: agreementHash,
        new_status: newStatus
      };
      
      const updateEffect = pipe(
        exchangesStore.updateAgreementStatus(updateInput),
        E.tap(() => E.sync(() => {
          showToast(`Agreement ${statusLabels[newStatus]} successfully!`, 'success');
        })),
        E.mapError((error) => ExchangeAgreementManagementError.fromError(error, 'updateAgreementStatus'))
      );
      
      await runEffect(updateEffect);
      
    } catch (error) {
      const updateError = ExchangeAgreementManagementError.fromError(error, 'updateAgreementStatus');
      showToast(updateError.message, 'error');
      state.error = updateError.message;
    }
  }
  
  // ============================================================================
  // PROGRESS AND MILESTONE MANAGEMENT
  // ============================================================================
  
  async function addProgressUpdate(
    agreementHash: ActionHash,
    update: Omit<CreateExchangeEventInput, "agreement_hash">
  ): Promise<void> {
    try {
      if (!canManageAgreements) {
        throw new Error('You do not have permission to add progress updates');
      }
      
      const eventInput: CreateExchangeEventInput = {
        ...update,
        agreement_hash: agreementHash
      };
      
      const createEventEffect = pipe(
        exchangesStore.createExchangeEvent(eventInput),
        E.tap(() => E.sync(() => {
          showToast('Progress update added successfully!', 'success');
        })),
        E.mapError((error) => ExchangeAgreementManagementError.fromError(error, 'addProgressUpdate'))
      );
      
      await runEffect(createEventEffect);
      
    } catch (error) {
      const updateError = ExchangeAgreementManagementError.fromError(error, 'addProgressUpdate');
      showToast(updateError.message, 'error');
      state.error = updateError.message;
    }
  }
  
  // ============================================================================
  // COMPLETION VALIDATION WORKFLOW
  // ============================================================================
  
  async function validateCompletion(
    agreementHash: ActionHash,
    validation: Omit<ValidateCompletionInput, "agreement_hash">
  ): Promise<void> {
    try {
      if (!canManageAgreements) {
        throw new Error('You do not have permission to validate completion');
      }
      
      const confirmed = await modal.confirm(
        'Are you sure you want to validate the completion of this agreement?<br/>This confirms that the service has been delivered to your satisfaction.',
        { confirmLabel: 'Validate Completion', cancelLabel: 'Cancel' }
      );
      
      if (!confirmed) return;
      
      const validationInput: ValidateCompletionInput = {
        ...validation,
        agreement_hash: agreementHash
      };
      
      const validateEffect = pipe(
        exchangesStore.validateCompletion(validationInput),
        E.tap(() => E.sync(() => {
          showToast('Completion validated successfully!', 'success');
        })),
        E.mapError((error) => ExchangeAgreementManagementError.fromError(error, 'validateCompletion'))
      );
      
      await runEffect(validateEffect);
      
    } catch (error) {
      const validateError = ExchangeAgreementManagementError.fromError(error, 'validateCompletion');
      showToast(validateError.message, 'error');
      state.error = validateError.message;
    }
  }
  
  // ============================================================================
  // FILTER MANAGEMENT METHODS
  // ============================================================================
  
  function setStatusFilter(status: AgreementStatus | "all"): void {
    isChangingFilterProgrammatically = true;
    state.statusFilter = status;
    updateURL();
    resetProgrammaticFlag();
  }
  
  function setRoleFilter(role: "provider" | "receiver" | "all"): void {
    isChangingFilterProgrammatically = true;
    state.roleFilter = role;
    updateURL();
    resetProgrammaticFlag();
  }
  
  function setParticipantFilter(filter: "all" | "my" | "involving_me"): void {
    state.participantFilter = filter;
  }
  
  function clearAllFilters(): void {
    isChangingFilterProgrammatically = true;
    state.statusFilter = 'all';
    state.roleFilter = 'all';
    state.participantFilter = 'all';
    updateURL();
    resetProgrammaticFlag();
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  function updateURL(): void {
    const url = new URL(window.location.href);
    
    // Update status parameter
    if (state.statusFilter === 'all') {
      url.searchParams.delete('status');
    } else {
      url.searchParams.set('status', state.statusFilter);
    }
    
    // Update role parameter
    if (state.roleFilter === 'all') {
      url.searchParams.delete('role');
    } else {
      url.searchParams.set('role', state.roleFilter);
    }
    
    const newUrl = url.pathname + (url.search ? url.search : '');
    goto(newUrl, { replaceState: true });
  }
  
  function resetProgrammaticFlag(): void {
    setTimeout(() => {
      isChangingFilterProgrammatically = false;
    }, 0);
  }
  
  function canUserManageAgreement(agreement: UIAgreement): boolean {
    if (!currentUser?.original_action_hash) return false;
    if (agentIsAdministrator) return true;
    
    const userHash = currentUser.original_action_hash.toString();
    return (agreement.provider_hash?.toString() === userHash) ||
           (agreement.receiver_hash?.toString() === userHash);
  }
  
  function getUserRoleInAgreement(agreement: UIAgreement): "provider" | "receiver" | "none" {
    if (!currentUser?.original_action_hash) return "none";
    
    const userHash = currentUser.original_action_hash.toString();
    
    if (agreement.provider_hash?.toString() === userHash) {
      return "provider";
    } else if (agreement.receiver_hash?.toString() === userHash) {
      return "receiver";
    }
    
    return "none";
  }
  
  async function getAgreementEvents(agreementHash: ActionHash): Promise<UIExchangeEvent[]> {
    try {
      const events = await runEffect(exchangesStore.getEventsForAgreement(agreementHash));
      return events;
    } catch (error) {
      console.error('Failed to get agreement events:', error);
      return [];
    }
  }
  
  async function refreshAgreements(): Promise<void> {
    try {
      await loadAgreements();
      showToast('Agreements refreshed successfully', 'success');
    } catch (error) {
      const refreshError = ExchangeAgreementManagementError.fromError(error, 'refreshAgreements');
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
    get filteredAgreements() {
      return state.filteredAgreements;
    },
    get statusFilter() {
      return state.statusFilter;
    },
    get roleFilter() {
      return state.roleFilter;
    },
    get participantFilter() {
      return state.participantFilter;
    },
    get hasInitialized() {
      return state.hasInitialized;
    },
    
    // Store state
    agreements,
    activeAgreements,
    inProgressAgreements,
    completedAgreements,
    cancelledAgreements,
    disputedAgreements,
    storeLoading,
    storeError,
    currentUser,
    canManageAgreements,
    
    // Actions
    initialize,
    loadAgreements,
    createAgreementFromProposal,
    updateAgreementStatus,
    addProgressUpdate,
    validateCompletion,
    setStatusFilter,
    setRoleFilter,
    setParticipantFilter,
    clearAllFilters,
    canUserManageAgreement,
    getUserRoleInAgreement,
    getAgreementEvents,
    refreshAgreements
  };
}