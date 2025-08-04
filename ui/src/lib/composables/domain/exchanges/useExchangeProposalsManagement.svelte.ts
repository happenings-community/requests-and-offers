import type { ActionHash } from '@holochain/client';
import type { 
  UIExchangeProposal, 
  UIRequest, 
  UIOffer, 
  UIUser, 
  BaseComposableState 
} from '$lib/types/ui';
import type { 
  ProposalStatus, 
  CreateExchangeProposalInput,
  UpdateProposalStatusInput 
} from '$lib/schemas/exchanges.schemas';

// Store imports
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import requestsStore from '$lib/stores/requests.store.svelte';
import offersStore from '$lib/stores/offers.store.svelte';
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
export class ExchangeProposalsManagementError extends Data.TaggedError('ExchangeProposalsManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ExchangeProposalsManagementError {
    if (error instanceof Error) {
      return new ExchangeProposalsManagementError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new ExchangeProposalsManagementError({
      message: String(error),
      context,
      cause: error
    });
  }
}

// State and Action Interfaces
export interface ExchangeProposalsManagementState extends BaseComposableState {
  filteredProposals: UIExchangeProposal[];
  proposalType: "DirectResponse" | "CrossLink" | "all";
  statusFilter: ProposalStatus | "all";
  participantFilter: "all" | "my" | "received" | "sent";
  hasInitialized: boolean;
}

export interface ExchangeProposalsManagementActions {
  initialize: () => Promise<void>;
  loadProposals: () => Promise<void>;
  
  // Proposal creation methods
  createDirectResponse: (
    targetEntityHash: ActionHash,
    targetEntityType: "request" | "offer",
    terms: Omit<CreateExchangeProposalInput, "proposal_type" | "target_entity_hash" | "responder_entity_hash">
  ) => Promise<void>;
  
  createCrossLinkProposal: (
    requestHash: ActionHash,
    offerHash: ActionHash,
    terms: Omit<CreateExchangeProposalInput, "proposal_type" | "target_entity_hash" | "responder_entity_hash">
  ) => Promise<void>;
  
  // Proposal management
  acceptProposal: (proposalHash: ActionHash) => Promise<void>;
  rejectProposal: (proposalHash: ActionHash, reason?: string) => Promise<void>;
  deleteProposal: (proposalHash: ActionHash) => Promise<void>;
  
  // Filter management
  setProposalTypeFilter: (type: "DirectResponse" | "CrossLink" | "all") => void;
  setStatusFilter: (status: ProposalStatus | "all") => void;
  setParticipantFilter: (filter: "all" | "my" | "received" | "sent") => void;
  clearAllFilters: () => void;
  
  // Utility methods
  canUserCreateProposals: () => boolean;
  getProposalsByEntity: (entityHash: ActionHash) => Promise<UIExchangeProposal[]>;
  refreshProposals: () => Promise<void>;
}

export interface UseExchangeProposalsManagement extends ExchangeProposalsManagementState, ExchangeProposalsManagementActions {
  // Store state accessors
  readonly proposals: UIExchangeProposal[];
  readonly pendingProposals: UIExchangeProposal[];
  readonly acceptedProposals: UIExchangeProposal[];
  readonly rejectedProposals: UIExchangeProposal[];
  readonly expiredProposals: UIExchangeProposal[];
  readonly storeLoading: boolean;
  readonly storeError: string | null;
  readonly currentUser: UIUser | null;
  readonly canCreateProposals: boolean;
}

/**
 * Exchange Proposals Management Composable
 * 
 * Provides comprehensive proposal creation, browsing, and management functionality.
 * Supports both Direct Response and Cross-Linking patterns as defined in the exchange process plan.
 * 
 * Features:
 * - Direct response to requests/offers with terms
 * - Cross-linking existing requests to matching offers  
 * - Proposal status tracking and filtering
 * - Integration with existing request/offer workflows
 * - User permission validation
 * - Real-time proposal updates and notifications
 * 
 * @returns Reactive state and actions for exchange proposal management
 */
export function useExchangeProposalsManagement(): UseExchangeProposalsManagement {
  const modal = useModal();
  
  // ============================================================================
  // STATE INITIALIZATION
  // ============================================================================
  
  // Initialize filter type from URL parameters
  const getInitialProposalTypeFilter = (): "DirectResponse" | "CrossLink" | "all" => {
    if (!page.url) return 'all';
    const typeParam = page.url.searchParams.get('type');
    if (typeParam === 'DirectResponse' || typeParam === 'CrossLink') {
      return typeParam;
    }
    return 'all';
  };
  
  const getInitialStatusFilter = (): ProposalStatus | "all" => {
    if (!page.url) return 'all';
    const statusParam = page.url.searchParams.get('status');
    if (statusParam === 'Pending' || statusParam === 'Accepted' || statusParam === 'Rejected' || statusParam === 'Expired') {
      return statusParam as ProposalStatus;
    }
    return 'all';
  };
  
  let state = $state<ExchangeProposalsManagementState>({
    isLoading: false,
    error: null,
    filteredProposals: [],
    proposalType: getInitialProposalTypeFilter(),
    statusFilter: getInitialStatusFilter(), 
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
    exchangeProposals: proposals,
    pendingProposals,
    acceptedProposals, 
    rejectedProposals,
    expiredProposals,
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
    
    const typeParam = page.url.searchParams.get('type');
    const statusParam = page.url.searchParams.get('status');
    
    // Update proposal type filter from URL
    if (typeParam === 'DirectResponse' || typeParam === 'CrossLink') {
      if (state.proposalType !== typeParam) {
        state.proposalType = typeParam;
      }
    } else if (typeParam === null && state.proposalType !== 'all') {
      state.proposalType = 'all';
    }
    
    // Update status filter from URL
    if (statusParam === 'Pending' || statusParam === 'Accepted' || statusParam === 'Rejected' || statusParam === 'Expired') {
      if (state.statusFilter !== statusParam) {
        state.statusFilter = statusParam as ProposalStatus;
      }
    } else if (statusParam === null && state.statusFilter !== 'all') {
      state.statusFilter = 'all';
    }
  });
  
  // ============================================================================
  // COMPUTED PROPERTIES AND FILTERING
  // ============================================================================
  
  // Filter proposals based on current filter settings
  const filteredProposals = $derived.by(() => {
    if (!proposals.length) return [];
    
    let filtered = [...proposals];
    
    // Apply proposal type filter
    if (state.proposalType !== 'all') {
      filtered = filtered.filter(proposal => proposal.proposal_type === state.proposalType);
    }
    
    // Apply status filter
    if (state.statusFilter !== 'all') {
      filtered = filtered.filter(proposal => proposal.status === state.statusFilter);
    }
    
    // Apply participant filter
    if (state.participantFilter !== 'all' && currentUser?.original_action_hash) {
      const userHash = currentUser.original_action_hash.toString();
      
      switch (state.participantFilter) {
        case 'my':
          // Proposals created by current user
          filtered = filtered.filter(proposal => 
            proposal.creator && proposal.creator.toString() === userHash
          );
          break;
        case 'received':
          // Proposals where current user is the target (received proposals)
          // This would need additional data from the store about target entities
          // For now, we'll implement basic filtering
          break;
        case 'sent':
          // Proposals sent by current user (same as 'my' for now)
          filtered = filtered.filter(proposal => 
            proposal.creator && proposal.creator.toString() === userHash
          );
          break;
      }
    }
    
    return filtered;
  });
  
  // Update state when filtered proposals change
  $effect(() => {
    state.filteredProposals = filteredProposals;
  });
  
  // Check if user can create proposals
  const canCreateProposals = $derived(
    currentUser?.status?.status_type === 'accepted' || agentIsAdministrator
  );
  
  // ============================================================================
  // DATA LOADING METHODS
  // ============================================================================
  
  const loadProposalsEffect = (): E.Effect<void, ExchangeProposalsManagementError> =>
    pipe(
      E.gen(function* () {
        // Validate user permissions first
        if (!currentUser) {
          state.error = 'Please create a user profile to view exchange proposals.';
          return yield* E.fail(
            new ExchangeProposalsManagementError({
              message: 'No user profile found',
              context: 'loadProposals'
            })
          );
        }
        
        if (!isUserApproved(currentUser) && !agentIsAdministrator) {
          const status = currentUser.status?.status_type;
          let errorMessage = 'Access denied. Only approved users can view exchange proposals.';
          
          if (status === 'pending') {
            errorMessage = "Your profile is pending approval. You'll be able to view exchange proposals once approved.";
          } else if (status === 'rejected') {
            errorMessage = 'Your profile has been rejected. Please contact an administrator.';
          } else if (status?.includes('suspended')) {
            errorMessage = 'Your profile is suspended. Please contact an administrator.';
          }
          
          state.error = errorMessage;
          return yield* E.fail(
            new ExchangeProposalsManagementError({
              message: errorMessage,
              context: 'loadProposals'
            })
          );
        }
        
        // Load all proposals
        yield* exchangesStore.getAllProposals();
        state.hasInitialized = true;
      }),
      E.mapError((error) => ExchangeProposalsManagementError.fromError(error, 'loadProposals'))
    );
  
  async function loadProposals(): Promise<void> {
    try {
      state.isLoading = true;
      state.error = null;
      await runEffect(loadProposalsEffect());
    } catch (error) {
      const proposalsError = ExchangeProposalsManagementError.fromError(error, 'loadProposals');
      state.error = proposalsError.message;
      showToast('Failed to load exchange proposals', 'error');
    } finally {
      state.isLoading = false;
    }
  }
  
  async function initialize(): Promise<void> {
    if (state.hasInitialized) return;
    
    try {
      state.isLoading = true;
      await loadProposals();
      
      // Also refresh current user data
      await runEffect(usersStore.refreshCurrentUser().pipe(
        E.catchAll((error) => {
          console.warn('Failed to refresh current user:', error);
          return E.void;
        })
      ));
      
    } catch (error) {
      const initError = ExchangeProposalsManagementError.fromError(error, 'initialize');
      state.error = initError.message;
      showToast('Failed to initialize exchange proposals', 'error');
    } finally {
      state.isLoading = false;
    }
  }
  
  // ============================================================================
  // PROPOSAL CREATION METHODS
  // ============================================================================
  
  async function createDirectResponse(
    targetEntityHash: ActionHash,
    targetEntityType: "request" | "offer",
    terms: Omit<CreateExchangeProposalInput, "proposal_type" | "target_entity_hash" | "responder_entity_hash">
  ): Promise<void> {
    try {
      if (!canUserCreateProposals()) {
        throw new Error('You do not have permission to create proposals');
      }
      
      if (!currentUser?.original_action_hash) {
        throw new Error('User profile not found');
      }
      
      const proposalInput: CreateExchangeProposalInput = {
        ...terms,
        proposal_type: "DirectResponse",
        target_entity_hash: targetEntityHash,
        responder_entity_hash: currentUser.original_action_hash
      };
      
      const createEffect = pipe(
        exchangesStore.createExchangeProposal(proposalInput),
        E.tap(() => E.sync(() => {
          showToast('Direct response proposal created successfully!', 'success');
        })),
        E.mapError((error) => ExchangeProposalsManagementError.fromError(error, 'createDirectResponse'))
      );
      
      await runEffect(createEffect);
      
      // Refresh proposals to show the new one
      await loadProposals();
      
    } catch (error) {
      const proposalError = ExchangeProposalsManagementError.fromError(error, 'createDirectResponse');
      showToast(proposalError.message, 'error');
      state.error = proposalError.message;
    }
  }
  
  async function createCrossLinkProposal(
    requestHash: ActionHash,
    offerHash: ActionHash,
    terms: Omit<CreateExchangeProposalInput, "proposal_type" | "target_entity_hash" | "responder_entity_hash">
  ): Promise<void> {
    try {
      if (!canUserCreateProposals()) {
        throw new Error('You do not have permission to create proposals');
      }
      
      if (!currentUser?.original_action_hash) {
        throw new Error('User profile not found');
      }
      
      const proposalInput: CreateExchangeProposalInput = {
        ...terms,
        proposal_type: "CrossLink",
        target_entity_hash: requestHash,
        responder_entity_hash: offerHash
      };
      
      const createEffect = pipe(
        exchangesStore.createExchangeProposal(proposalInput),
        E.tap(() => E.sync(() => {
          showToast('Cross-link proposal created successfully!', 'success');
        })),
        E.mapError((error) => ExchangeProposalsManagementError.fromError(error, 'createCrossLinkProposal'))
      );
      
      await runEffect(createEffect);
      
      // Refresh proposals to show the new one
      await loadProposals();
      
    } catch (error) {
      const proposalError = ExchangeProposalsManagementError.fromError(error, 'createCrossLinkProposal');
      showToast(proposalError.message, 'error');
      state.error = proposalError.message;
    }
  }
  
  // ============================================================================
  // PROPOSAL MANAGEMENT METHODS
  // ============================================================================
  
  async function acceptProposal(proposalHash: ActionHash): Promise<void> {
    try {
      const confirmed = await modal.confirm(
        'Are you sure you want to accept this proposal?<br/>This will create a binding agreement.',
        { confirmLabel: 'Accept', cancelLabel: 'Cancel' }
      );
      
      if (!confirmed) return;
      
      const updateInput: UpdateProposalStatusInput = {
        proposal_hash: proposalHash,
        new_status: 'Accepted'
      };
      
      const acceptEffect = pipe(
        exchangesStore.updateProposalStatus(updateInput),
        E.tap(() => E.sync(() => {
          showToast('Proposal accepted successfully!', 'success');
        })),
        E.mapError((error) => ExchangeProposalsManagementError.fromError(error, 'acceptProposal'))
      );
      
      await runEffect(acceptEffect);
      
    } catch (error) {
      const acceptError = ExchangeProposalsManagementError.fromError(error, 'acceptProposal');
      showToast(acceptError.message, 'error');
      state.error = acceptError.message;
    }
  }
  
  async function rejectProposal(proposalHash: ActionHash, reason?: string): Promise<void> {
    try {
      const confirmed = await modal.confirm(
        'Are you sure you want to reject this proposal?<br/>This action cannot be undone.',
        { confirmLabel: 'Reject', cancelLabel: 'Cancel' }
      );
      
      if (!confirmed) return;
      
      const updateInput: UpdateProposalStatusInput = {
        proposal_hash: proposalHash,
        new_status: 'Rejected'
      };
      
      const rejectEffect = pipe(
        exchangesStore.updateProposalStatus(updateInput),
        E.tap(() => E.sync(() => {
          showToast('Proposal rejected', 'success');
        })),
        E.mapError((error) => ExchangeProposalsManagementError.fromError(error, 'rejectProposal'))
      );
      
      await runEffect(rejectEffect);
      
    } catch (error) {
      const rejectError = ExchangeProposalsManagementError.fromError(error, 'rejectProposal');
      showToast(rejectError.message, 'error');
      state.error = rejectError.message;
    }
  }
  
  async function deleteProposal(proposalHash: ActionHash): Promise<void> {
    try {
      const confirmed = await modal.confirm(
        'Are you sure you want to delete this proposal?<br/>This action cannot be undone.',
        { confirmLabel: 'Delete', cancelLabel: 'Cancel' }
      );
      
      if (!confirmed) return;
      
      const deleteEffect = pipe(
        exchangesStore.deleteExchangeProposal(proposalHash),
        E.tap(() => E.sync(() => {
          showToast('Proposal deleted successfully', 'success');
        })),
        E.mapError((error) => ExchangeProposalsManagementError.fromError(error, 'deleteProposal'))
      );
      
      await runEffect(deleteEffect);
      
    } catch (error) {
      const deleteError = ExchangeProposalsManagementError.fromError(error, 'deleteProposal');
      showToast(deleteError.message, 'error');
      state.error = deleteError.message;
    }
  }
  
  // ============================================================================
  // FILTER MANAGEMENT METHODS
  // ============================================================================
  
  function setProposalTypeFilter(type: "DirectResponse" | "CrossLink" | "all"): void {
    isChangingFilterProgrammatically = true;
    state.proposalType = type;
    updateURL();
    resetProgrammaticFlag();
  }
  
  function setStatusFilter(status: ProposalStatus | "all"): void {
    isChangingFilterProgrammatically = true;
    state.statusFilter = status;
    updateURL();
    resetProgrammaticFlag();
  }
  
  function setParticipantFilter(filter: "all" | "my" | "received" | "sent"): void {
    state.participantFilter = filter;
  }
  
  function clearAllFilters(): void {
    isChangingFilterProgrammatically = true;
    state.proposalType = 'all';
    state.statusFilter = 'all';
    state.participantFilter = 'all';
    updateURL();
    resetProgrammaticFlag();
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  function updateURL(): void {
    const url = new URL(window.location.href);
    
    // Update proposal type parameter
    if (state.proposalType === 'all') {
      url.searchParams.delete('type');
    } else {
      url.searchParams.set('type', state.proposalType);
    }
    
    // Update status parameter
    if (state.statusFilter === 'all') {
      url.searchParams.delete('status');
    } else {
      url.searchParams.set('status', state.statusFilter);
    }
    
    const newUrl = url.pathname + (url.search ? url.search : '');
    goto(newUrl, { replaceState: true });
  }
  
  function resetProgrammaticFlag(): void {
    setTimeout(() => {
      isChangingFilterProgrammatically = false;
    }, 0);
  }
  
  function canUserCreateProposals(): boolean {
    return canCreateProposals;
  }
  
  async function getProposalsByEntity(entityHash: ActionHash): Promise<UIExchangeProposal[]> {
    try {
      const proposals = await runEffect(exchangesStore.getProposalsForEntity(entityHash));
      return proposals;
    } catch (error) {
      console.error('Failed to get proposals by entity:', error);
      return [];
    }
  }
  
  async function refreshProposals(): Promise<void> {
    try {
      await loadProposals();
      showToast('Proposals refreshed successfully', 'success');
    } catch (error) {
      const refreshError = ExchangeProposalsManagementError.fromError(error, 'refreshProposals');
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
    get filteredProposals() {
      return state.filteredProposals;
    },
    get proposalType() {
      return state.proposalType;
    },
    get statusFilter() {
      return state.statusFilter;
    },
    get participantFilter() {
      return state.participantFilter;
    },
    get hasInitialized() {
      return state.hasInitialized;
    },
    
    // Store state
    proposals,
    pendingProposals,
    acceptedProposals,
    rejectedProposals,
    expiredProposals,
    storeLoading,
    storeError,
    currentUser,
    canCreateProposals,
    
    // Actions
    initialize,
    loadProposals,
    createDirectResponse,
    createCrossLinkProposal,
    acceptProposal,
    rejectProposal,
    deleteProposal,
    setProposalTypeFilter,
    setStatusFilter,
    setParticipantFilter,
    clearAllFilters,
    canUserCreateProposals,
    getProposalsByEntity,
    refreshProposals
  };
}