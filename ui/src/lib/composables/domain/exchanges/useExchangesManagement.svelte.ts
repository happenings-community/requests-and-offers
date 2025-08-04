import type { ActionHash } from '@holochain/client';
import type {
  UIExchangeProposal,
  UIAgreement,
  UIExchangeEvent,
  UIExchangeReview,
  UIExchangeCancellation,
  BaseComposableState
} from '$lib/types/ui';
import type { ProposalStatus, AgreementStatus } from '$lib/schemas/exchanges.schemas';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';
import { Effect as E, Data, pipe } from 'effect';
import { page } from '$app/state';

// Typed error for the composable
export class ExchangesManagementError extends Data.TaggedError('ExchangesManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ExchangesManagementError {
    if (error instanceof Error) {
      return new ExchangesManagementError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new ExchangesManagementError({
      message: String(error),
      context,
      cause: error
    });
  }
}

export interface ExchangesManagementState extends BaseComposableState {
  // Filtered data
  filteredProposals: UIExchangeProposal[];
  filteredAgreements: UIAgreement[];
  filteredEvents: UIExchangeEvent[];
  filteredReviews: UIExchangeReview[];
  filteredCancellations: UIExchangeCancellation[];
  
  // Filter configuration
  proposalStatusFilter: ProposalStatus | 'all';
  agreementStatusFilter: AgreementStatus | 'all';
  entityTypeFilter: 'proposals' | 'agreements' | 'events' | 'reviews' | 'cancellations' | 'all';
  participantFilter: 'all' | 'my' | 'involving_me';
  
  // Dashboard statistics  
  dashboardStats: {
    totalProposals: number;
    pendingProposals: number;
    activeAgreements: number;
    completedAgreements: number;
    totalEvents: number;
    totalReviews: number;
    totalCancellations: number;
  };
  
  hasInitialized: boolean;
}

export interface ExchangesManagementActions {
  initialize: () => Promise<void>;
  
  // Data loading methods
  loadAllData: () => Promise<void>;
  loadProposals: () => Promise<void>;
  loadAgreements: () => Promise<void>;
  loadEvents: () => Promise<void>;
  loadReviews: () => Promise<void>;
  loadCancellations: () => Promise<void>;
  
  // Filter management
  setProposalStatusFilter: (status: ProposalStatus | 'all') => void;
  setAgreementStatusFilter: (status: AgreementStatus | 'all') => void;
  setEntityTypeFilter: (type: 'proposals' | 'agreements' | 'events' | 'reviews' | 'cancellations' | 'all') => void;
  setParticipantFilter: (filter: 'all' | 'my' | 'involving_me') => void;
  clearAllFilters: () => void;
  
  // Quick actions
  refreshDashboard: () => Promise<void>;
  getEntityCounts: () => Promise<void>;
  
  // Navigation helpers
  navigateToProposal: (proposalHash: ActionHash) => void;
  navigateToAgreement: (agreementHash: ActionHash) => void;
  navigateToExchangeDetail: (entityHash: ActionHash, entityType: 'proposal' | 'agreement') => void;
}

export interface UseExchangesManagement extends ExchangesManagementState, ExchangesManagementActions {
  // Computed properties
  readonly hasData: boolean;
  readonly isEmpty: boolean;
  readonly activeFiltersCount: number;
}

/**
 * Exchanges Management Composable
 * 
 * Provides comprehensive dashboard and list management functionality for all exchange entities.
 * Handles filtering, statistics, bulk operations, and navigation.
 * 
 * Features:
 * - Multi-entity filtering (proposals, agreements, events, reviews, cancellations)
 * - Status-based filtering for proposals and agreements
 * - Participant-based filtering (all, my, involving me)
 * - Dashboard statistics and counts
 * - Bulk operations and navigation helpers
 * - Real-time data synchronization with the exchanges store
 * 
 * @returns Reactive state and actions for exchange management
 */
export function useExchangesManagement(): UseExchangesManagement {
  // ============================================================================
  // STATE INITIALIZATION
  // ============================================================================
  
  let isLoading = $state(false);
  let error: string | null = $state(null);
  let hasInitialized = $state(false);
  
  // Filter state
  let proposalStatusFilter: ProposalStatus | 'all' = $state('all');
  let agreementStatusFilter: AgreementStatus | 'all' = $state('all');
  let entityTypeFilter: 'proposals' | 'agreements' | 'events' | 'reviews' | 'cancellations' | 'all' = $state('all');
  let participantFilter: 'all' | 'my' | 'involving_me' = $state('all');
  
  // Dashboard statistics
  let dashboardStats = $state({
    totalProposals: 0,
    pendingProposals: 0,
    activeAgreements: 0,
    completedAgreements: 0,
    totalEvents: 0,
    totalReviews: 0,
    totalCancellations: 0
  });

  // ============================================================================
  // COMPUTED PROPERTIES
  // ============================================================================
  
  // Filtered data based on current filters
  const filteredProposals = $derived.by(() => {
    let proposals = exchangesStore.exchangeProposals;
    
    // Apply status filter
    if (proposalStatusFilter !== 'all') {
      proposals = proposals.filter(p => p.status === proposalStatusFilter);
    }
    
    // Apply participant filter (simplified for now)
    if (participantFilter === 'my') {
      // TODO: Filter by current user's proposals
      // proposals = proposals.filter(p => p.creator === currentUserHash);
    }
    
    return proposals;
  });
  
  const filteredAgreements = $derived.by(() => {
    let agreements = exchangesStore.agreements;
    
    // Apply status filter
    if (agreementStatusFilter !== 'all') {
      agreements = agreements.filter(a => a.status === agreementStatusFilter);
    }
    
    // Apply participant filter (simplified for now)
    if (participantFilter === 'my') {
      // TODO: Filter by current user's agreements
      // agreements = agreements.filter(a => a.provider_hash === currentUserHash || a.receiver_hash === currentUserHash);
    }
    
    return agreements;
  });
  
  const filteredEvents = $derived.by(() => {
    let events = exchangesStore.exchangeEvents;
    
    // Apply participant filter (simplified for now)
    if (participantFilter === 'my') {
      // TODO: Filter by events where user is involved
    }
    
    return events;
  });
  
  const filteredReviews = $derived.by(() => {
    let reviews = exchangesStore.exchangeReviews;
    
    // Apply participant filter (simplified for now)
    if (participantFilter === 'my') {
      // TODO: Filter by reviews created by or about the user
    }
    
    return reviews;
  });
  
  const filteredCancellations = $derived.by(() => {
    let cancellations = exchangesStore.exchangeCancellations;
    
    // Apply participant filter (simplified for now)
    if (participantFilter === 'my') {
      // TODO: Filter by cancellations involving the user
    }
    
    return cancellations;
  });
  
  // Dashboard computed properties
  const hasData = $derived(
    exchangesStore.exchangeProposals.length > 0 ||
    exchangesStore.agreements.length > 0 ||
    exchangesStore.exchangeEvents.length > 0 ||
    exchangesStore.exchangeReviews.length > 0 ||
    exchangesStore.exchangeCancellations.length > 0
  );
  
  const isEmpty = $derived(!hasData);
  
  const activeFiltersCount = $derived.by(() => {
    let count = 0;
    if (proposalStatusFilter !== 'all') count++;
    if (agreementStatusFilter !== 'all') count++;
    if (entityTypeFilter !== 'all') count++;
    if (participantFilter !== 'all') count++;
    return count;
  });

  // ============================================================================
  // DATA LOADING METHODS
  // ============================================================================
  
  const initialize = async (): Promise<void> => {
    if (hasInitialized) return;
    
    try {
      isLoading = true;
      error = null;
      
      await loadAllData();
      hasInitialized = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error('Failed to initialize exchanges management:', err);
    } finally {
      isLoading = false;
    }
  };
  
  const loadAllData = async (): Promise<void> => {
    try {
      isLoading = true;
      error = null;
      
      // Load all exchange data in parallel
      await Promise.all([
        loadProposals(),
        loadAgreements(),
        loadEvents(),
        loadReviews(),
        loadCancellations()
      ]);
      
      await getEntityCounts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error = errorMessage;
      showToast(`Failed to load exchange data: ${errorMessage}`, 'error');
      throw ExchangesManagementError.fromError(err, 'loadAllData');
    } finally {
      isLoading = false;
    }
  };
  
  const loadProposals = async (): Promise<void> => {
    try {
      await runEffect(exchangesStore.getAllProposals());
    } catch (err) {
      console.error('Failed to load proposals:', err);
      throw ExchangesManagementError.fromError(err, 'loadProposals');
    }
  };
  
  const loadAgreements = async (): Promise<void> => {
    try {
      await runEffect(exchangesStore.getAllAgreements());
    } catch (err) {
      console.error('Failed to load agreements:', err);
      throw ExchangesManagementError.fromError(err, 'loadAgreements');
    }
  };
  
  const loadEvents = async (): Promise<void> => {
    try {
      await runEffect(exchangesStore.getAllExchangeEvents());
    } catch (err) {
      console.error('Failed to load events:', err);
      throw ExchangesManagementError.fromError(err, 'loadEvents');
    }
  };
  
  const loadReviews = async (): Promise<void> => {
    try {
      await runEffect(exchangesStore.getAllExchangeReviews());
    } catch (err) {
      console.error('Failed to load reviews:', err);
      throw ExchangesManagementError.fromError(err, 'loadReviews');
    }
  };
  
  const loadCancellations = async (): Promise<void> => {
    try {
      await runEffect(exchangesStore.getAllExchangeCancellations());
    } catch (err) {
      console.error('Failed to load cancellations:', err);
      throw ExchangesManagementError.fromError(err, 'loadCancellations');
    }
  };

  // ============================================================================
  // FILTER MANAGEMENT METHODS
  // ============================================================================
  
  const setProposalStatusFilter = (status: ProposalStatus | 'all'): void => {
    proposalStatusFilter = status;
  };
  
  const setAgreementStatusFilter = (status: AgreementStatus | 'all'): void => {
    agreementStatusFilter = status;
  };
  
  const setEntityTypeFilter = (type: 'proposals' | 'agreements' | 'events' | 'reviews' | 'cancellations' | 'all'): void => {
    entityTypeFilter = type;
  };
  
  const setParticipantFilter = (filter: 'all' | 'my' | 'involving_me'): void => {
    participantFilter = filter;
  };
  
  const clearAllFilters = (): void => {
    proposalStatusFilter = 'all';
    agreementStatusFilter = 'all';
    entityTypeFilter = 'all';
    participantFilter = 'all';
  };

  // ============================================================================
  // DASHBOARD AND STATISTICS METHODS
  // ============================================================================
  
  const refreshDashboard = async (): Promise<void> => {
    try {
      await loadAllData();
      showToast('Dashboard refreshed successfully', 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      showToast(`Failed to refresh dashboard: ${errorMessage}`, 'error');
      throw ExchangesManagementError.fromError(err, 'refreshDashboard');
    }
  };
  
  const getEntityCounts = async (): Promise<void> => {
    try {
      // Update dashboard statistics
      dashboardStats = {
        totalProposals: exchangesStore.exchangeProposals.length,
        pendingProposals: exchangesStore.pendingProposals.length,
        activeAgreements: exchangesStore.activeAgreements.length,
        completedAgreements: exchangesStore.completedAgreements.length,
        totalEvents: exchangesStore.exchangeEvents.length,
        totalReviews: exchangesStore.exchangeReviews.length,
        totalCancellations: exchangesStore.exchangeCancellations.length
      };
    } catch (err) {
      console.error('Failed to get entity counts:', err);
      throw ExchangesManagementError.fromError(err, 'getEntityCounts');
    }
  };

  // ============================================================================
  // NAVIGATION HELPER METHODS
  // ============================================================================
  
  const navigateToProposal = (proposalHash: ActionHash): void => {
    // TODO: Implement navigation to proposal detail page
    // goto(`/exchanges/proposals/${encodeHashToBase64(proposalHash)}`);
    console.log('Navigate to proposal:', proposalHash);
  };
  
  const navigateToAgreement = (agreementHash: ActionHash): void => {
    // TODO: Implement navigation to agreement detail page
    // goto(`/exchanges/agreements/${encodeHashToBase64(agreementHash)}`);
    console.log('Navigate to agreement:', agreementHash);
  };
  
  const navigateToExchangeDetail = (entityHash: ActionHash, entityType: 'proposal' | 'agreement'): void => {
    if (entityType === 'proposal') {
      navigateToProposal(entityHash);
    } else {
      navigateToAgreement(entityHash);
    }
  };

  // ============================================================================
  // COMPOSABLE INTERFACE RETURN
  // ============================================================================
  
  return {
    // State
    get isLoading() { return isLoading; },
    get error() { return error; },
    get hasInitialized() { return hasInitialized; },
    get filteredProposals() { return filteredProposals; },
    get filteredAgreements() { return filteredAgreements; },
    get filteredEvents() { return filteredEvents; },
    get filteredReviews() { return filteredReviews; },
    get filteredCancellations() { return filteredCancellations; },
    get proposalStatusFilter() { return proposalStatusFilter; },
    get agreementStatusFilter() { return agreementStatusFilter; },
    get entityTypeFilter() { return entityTypeFilter; },
    get participantFilter() { return participantFilter; },
    get dashboardStats() { return dashboardStats; },
    
    // Computed properties
    get hasData() { return hasData; },
    get isEmpty() { return isEmpty; },
    get activeFiltersCount() { return activeFiltersCount; },
    
    // Actions
    initialize,
    loadAllData,
    loadProposals,
    loadAgreements,
    loadEvents,
    loadReviews,
    loadCancellations,
    setProposalStatusFilter,
    setAgreementStatusFilter,
    setEntityTypeFilter,
    setParticipantFilter,
    clearAllFilters,
    refreshDashboard,
    getEntityCounts,
    navigateToProposal,
    navigateToAgreement,
    navigateToExchangeDetail
  };
}