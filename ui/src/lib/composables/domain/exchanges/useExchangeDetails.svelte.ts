import type { ActionHash } from '@holochain/client';
import { encodeHashToBase64, decodeHashFromBase64 } from '@holochain/client';
import type { 
  UIExchangeProposal, 
  UIAgreement,
  UIExchangeEvent,
  UIExchangeReview,
  UIExchangeCancellation,
  UIRequest, 
  UIOffer, 
  UIUser,
  BaseComposableState 
} from '$lib/types/ui';

// Store imports
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import requestsStore from '$lib/stores/requests.store.svelte';
import offersStore from '$lib/stores/offers.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import administrationStore from '$lib/stores/administration.store.svelte';

// Utility imports
import { runEffect } from '$lib/utils/effect';
import { showToast, isUserApproved } from '$lib/utils';
import { Effect as E, Data, pipe } from 'effect';

// Error handling
export class ExchangeDetailsError extends Data.TaggedError('ExchangeDetailsError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ExchangeDetailsError {
    if (error instanceof Error) {
      return new ExchangeDetailsError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new ExchangeDetailsError({
      message: String(error),
      context,
      cause: error
    });
  }
}

// Exchange Action Types
export type ExchangeAction = 
  | 'accept_proposal'
  | 'reject_proposal'
  | 'delete_proposal'
  | 'create_agreement'
  | 'update_status'
  | 'add_progress'
  | 'validate_completion'
  | 'initiate_cancellation'
  | 'respond_to_cancellation'
  | 'create_review'
  | 'view_only';

// State and Action Interfaces
export interface ExchangeDetailsState extends BaseComposableState {
  // Core exchange data
  proposal: UIExchangeProposal | null;
  agreement: UIAgreement | null;
  events: UIExchangeEvent[];
  reviews: UIExchangeReview[];
  cancellation: UIExchangeCancellation | null;
  
  // Related entity data
  relatedRequest: UIRequest | null;
  relatedOffer: UIOffer | null;
  
  // User context
  userRole: "creator" | "target" | "provider" | "receiver" | "observer";
  availableActions: ExchangeAction[];
  
  // Loading states
  hasInitialized: boolean;
  isRefreshing: boolean;
}

export interface ExchangeDetailsActions {
  // Initialization methods
  initialize: (exchangeHash: ActionHash, exchangeType: 'proposal' | 'agreement') => Promise<void>;
  loadExchangeData: (exchangeHash: ActionHash, exchangeType: 'proposal' | 'agreement') => Promise<void>;
  refreshExchangeData: () => Promise<void>;
  
  // Action availability checks
  getAvailableActions: () => ExchangeAction[];
  canUserPerformAction: (action: ExchangeAction) => boolean;
  
  // Quick status checks
  isProposalPending: () => boolean;
  isAgreementActive: () => boolean;
  isExchangeCompleted: () => boolean;
  isExchangeCancelled: () => boolean;
  needsUserValidation: () => boolean;
  
  // Related data loading
  loadRelatedEntities: () => Promise<void>;
  loadExchangeHistory: () => Promise<void>;
  
  // Utility methods
  getDisplayTitle: () => string;
  getExchangeTimeline: () => Array<{
    type: 'proposal' | 'agreement' | 'event' | 'review' | 'cancellation';
    data: any;
    timestamp: number;
    title: string;
    description: string;
  }>;
  getUserDisplayRole: () => string;
}

export interface UseExchangeDetails extends ExchangeDetailsState, ExchangeDetailsActions {
  // Store state accessors
  readonly currentUser: UIUser | null;
  readonly storeLoading: boolean;
  readonly storeError: string | null;
  readonly isAdministrator: boolean;
}

/**
 * Exchange Details Composable
 * 
 * Single source of truth for individual exchange data loading and management.
 * Provides comprehensive exchange information including proposals, agreements, 
 * events, reviews, and related entities.
 * 
 * Features:
 * - Exchange-specific data loading and caching
 * - Related entity fetching (requests, offers, users)
 * - Status-specific UI state management
 * - Action availability based on user role and exchange state
 * - Timeline view of all exchange activities
 * - User role detection and permission management
 * - Real-time data synchronization
 * 
 * @returns Reactive state and actions for individual exchange details
 */
export function useExchangeDetails(): UseExchangeDetails {
  
  // ============================================================================
  // STATE INITIALIZATION
  // ============================================================================
  
  let state = $state<ExchangeDetailsState>({
    isLoading: false,
    error: null,
    
    // Core exchange data
    proposal: null,
    agreement: null,
    events: [],
    reviews: [],
    cancellation: null,
    
    // Related entity data
    relatedRequest: null,
    relatedOffer: null,
    
    // User context
    userRole: "observer",
    availableActions: [],
    
    // Loading states
    hasInitialized: false,
    isRefreshing: false
  });
  
  // Track current exchange for refreshing
  let currentExchangeHash: ActionHash | null = null;
  let currentExchangeType: 'proposal' | 'agreement' | null = null;
  
  // ============================================================================
  // REACTIVE STATE FROM STORES
  // ============================================================================
  
  const { currentUser } = usersStore;
  const { loading: storeLoading, error: storeError } = exchangesStore;
  const { agentIsAdministrator: isAdministrator } = $derived(administrationStore);
  
  // ============================================================================
  // DATA LOADING METHODS
  // ============================================================================
  
  const loadExchangeDataEffect = (
    exchangeHash: ActionHash, 
    exchangeType: 'proposal' | 'agreement'
  ): E.Effect<void, ExchangeDetailsError> =>
    pipe(
      E.gen(function* () {
        // Validate user permissions first
        if (!currentUser) {
          state.error = 'Please create a user profile to view exchange details.';
          return yield* E.fail(
            new ExchangeDetailsError({
              message: 'No user profile found',
              context: 'loadExchangeData'
            })
          );
        }
        
        if (!isUserApproved(currentUser) && !isAdministrator) {
          const status = currentUser.status?.status_type;
          let errorMessage = 'Access denied. Only approved users can view exchange details.';
          
          if (status === 'pending') {
            errorMessage = "Your profile is pending approval. You'll be able to view exchange details once approved.";
          } else if (status === 'rejected') {
            errorMessage = 'Your profile has been rejected. Please contact an administrator.';
          } else if (status?.includes('suspended')) {
            errorMessage = 'Your profile is suspended. Please contact an administrator.';
          }
          
          state.error = errorMessage;
          return yield* E.fail(
            new ExchangeDetailsError({
              message: errorMessage,
              context: 'loadExchangeData'
            })
          );
        }
        
        // Load the primary exchange entity
        if (exchangeType === 'proposal') {
          const proposal = yield* exchangesStore.getExchangeProposal(exchangeHash);
          state.proposal = proposal;
          
          // If proposal is accepted, try to load the associated agreement
          if (proposal && proposal.status === 'Accepted') {
            // Find agreement that references this proposal
            const allAgreements = yield* exchangesStore.getAllAgreements();
            const associatedAgreement = allAgreements.find(a => 
              a.proposal_hash && encodeHashToBase64(a.proposal_hash) === encodeHashToBase64(exchangeHash)
            );
            state.agreement = associatedAgreement || null;
          }
        } else {
          const agreement = yield* exchangesStore.getAgreement(exchangeHash);
          state.agreement = agreement;
          
          // Load the associated proposal if available
          if (agreement?.proposal_hash) {
            const proposal = yield* exchangesStore.getExchangeProposal(agreement.proposal_hash);
            state.proposal = proposal;
          }
        }
        
        // Load related exchange data
        yield* pipe(
          E.all([
            // Load events for the agreement (if we have one)
            state.agreement 
              ? exchangesStore.getEventsForAgreement(state.agreement.original_action_hash!)
              : E.succeed([]),
            
            // Load reviews for the agreement (if we have one)
            state.agreement 
              ? exchangesStore.getReviewsForAgreement(state.agreement.original_action_hash!)
              : E.succeed([]),
            
            // Load cancellation for the agreement (if we have one)
            state.agreement 
              ? exchangesStore.getCancellationsForAgreement(state.agreement.original_action_hash!)
              : E.succeed([])
          ]),
          E.map(([events, reviews, cancellations]) => {
            state.events = events;
            state.reviews = reviews;
            state.cancellation = cancellations.length > 0 ? cancellations[0] : null;
          })
        );
        
        // Determine user role and available actions
        determineUserRole();
        updateAvailableActions();
        
        state.hasInitialized = true;
      }),
      E.mapError((error) => ExchangeDetailsError.fromError(error, 'loadExchangeData'))
    );
  
  async function loadExchangeData(
    exchangeHash: ActionHash, 
    exchangeType: 'proposal' | 'agreement'
  ): Promise<void> {
    try {
      state.isLoading = true;
      state.error = null;
      
      // Store current exchange info for refreshing
      currentExchangeHash = exchangeHash;
      currentExchangeType = exchangeType;
      
      await runEffect(loadExchangeDataEffect(exchangeHash, exchangeType));
      
      // Load related entities after main data is loaded
      await loadRelatedEntities();
      
    } catch (error) {
      const detailsError = ExchangeDetailsError.fromError(error, 'loadExchangeData');
      state.error = detailsError.message;
      showToast('Failed to load exchange details', 'error');
    } finally {
      state.isLoading = false;
    }
  }
  
  async function initialize(
    exchangeHash: ActionHash, 
    exchangeType: 'proposal' | 'agreement'
  ): Promise<void> {
    if (state.hasInitialized && 
        currentExchangeHash && 
        encodeHashToBase64(currentExchangeHash) === encodeHashToBase64(exchangeHash) &&
        currentExchangeType === exchangeType) {
      return;
    }
    
    // Reset state for new exchange
    state.hasInitialized = false;
    
    await loadExchangeData(exchangeHash, exchangeType);
  }
  
  async function refreshExchangeData(): Promise<void> {
    if (!currentExchangeHash || !currentExchangeType) {
      console.warn('No current exchange to refresh');
      return;
    }
    
    try {
      state.isRefreshing = true;
      await loadExchangeData(currentExchangeHash, currentExchangeType);
      showToast('Exchange data refreshed', 'success');
    } catch (error) {
      const refreshError = ExchangeDetailsError.fromError(error, 'refreshExchangeData');
      showToast(refreshError.message, 'error');
    } finally {
      state.isRefreshing = false;
    }
  }
  
  // ============================================================================
  // RELATED DATA LOADING
  // ============================================================================
  
  async function loadRelatedEntities(): Promise<void> {
    try {
      // Load related request/offer entities
      if (state.proposal) {
        if (state.proposal.target_entity_hash) {
          // Try to load as request first, then as offer
          try {
            const request = await runEffect(requestsStore.getRequest(state.proposal.target_entity_hash));
            if (request) {
              state.relatedRequest = request;
            } else {
              const offer = await runEffect(offersStore.getOffer(state.proposal.target_entity_hash));
              state.relatedOffer = offer;
            }
          } catch (error) {
            console.warn('Failed to load related entity:', error);
          }
        }
        
        // For cross-link proposals, load the responder entity too
        if (state.proposal.proposal_type === 'CrossLink' && state.proposal.responder_entity_hash) {
          try {
            if (state.relatedRequest) {
              // If we have a request, the responder entity should be an offer
              const offer = await runEffect(offersStore.getOffer(state.proposal.responder_entity_hash));
              state.relatedOffer = offer;
            } else if (state.relatedOffer) {
              // If we have an offer, the responder entity should be a request
              const request = await runEffect(requestsStore.getRequest(state.proposal.responder_entity_hash));
              state.relatedRequest = request;
            }
          } catch (error) {
            console.warn('Failed to load responder entity:', error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load related entities:', error);
    }
  }
  
  async function loadExchangeHistory(): Promise<void> {
    if (!state.agreement?.original_action_hash) return;
    
    try {
      // Reload all historical data
      const [events, reviews, cancellations] = await Promise.all([
        runEffect(exchangesStore.getEventsForAgreement(state.agreement.original_action_hash)),
        runEffect(exchangesStore.getReviewsForAgreement(state.agreement.original_action_hash)),
        runEffect(exchangesStore.getCancellationsForAgreement(state.agreement.original_action_hash))
      ]);
      
      state.events = events;
      state.reviews = reviews;
      state.cancellation = cancellations.length > 0 ? cancellations[0] : null;
      
    } catch (error) {
      console.error('Failed to load exchange history:', error);
    }
  }
  
  // ============================================================================
  // USER ROLE AND ACTION MANAGEMENT
  // ============================================================================
  
  function determineUserRole(): void {
    if (!currentUser?.original_action_hash) {
      state.userRole = "observer";
      return;
    }
    
    const userHash = currentUser.original_action_hash.toString();
    
    // Check if user is the proposal creator
    if (state.proposal?.creator?.toString() === userHash) {
      state.userRole = "creator";
      return;
    }
    
    // Check if user is provider or receiver in agreement
    if (state.agreement) {
      if (state.agreement.provider_hash?.toString() === userHash) {
        state.userRole = "provider";
        return;
      } else if (state.agreement.receiver_hash?.toString() === userHash) {
        state.userRole = "receiver";
        return;
      }
    }
    
    // Check if user is the target of the proposal (for direct responses)
    if (state.proposal?.proposal_type === 'DirectResponse') {
      // For direct responses, we'd need to check if the user owns the target entity
      // This would require additional logic to determine entity ownership
      if (state.relatedRequest?.creator?.toString() === userHash ||
          state.relatedOffer?.creator?.toString() === userHash) {
        state.userRole = "target";
        return;
      }
    }
    
    state.userRole = "observer";
  }
  
  function updateAvailableActions(): void {
    const actions: ExchangeAction[] = [];
    
    if (!currentUser?.original_action_hash) {
      state.availableActions = ['view_only'];
      return;
    }
    
    // Administrator can perform most actions
    if (isAdministrator) {
      actions.push('view_only');
      if (state.proposal && state.proposal.status === 'Pending') {
        actions.push('accept_proposal', 'reject_proposal');
      }
      if (state.agreement && !isExchangeCompleted()) {
        actions.push('update_status', 'add_progress');
      }
    } else {
      // Regular user actions based on role
      switch (state.userRole) {
        case 'creator':
          actions.push('view_only');
          if (state.proposal && state.proposal.status === 'Pending') {
            actions.push('delete_proposal');
          }
          break;
          
        case 'target':
          actions.push('view_only');
          if (state.proposal && state.proposal.status === 'Pending') {
            actions.push('accept_proposal', 'reject_proposal');
          }
          if (!state.agreement && state.proposal && state.proposal.status === 'Accepted') {
            actions.push('create_agreement');
          }
          break;
          
        case 'provider':
        case 'receiver':
          actions.push('view_only');
          if (state.agreement && !isExchangeCompleted() && !isExchangeCancelled()) {
            actions.push('add_progress', 'initiate_cancellation');
            
            if (state.agreement.status === 'InProgress') {
              actions.push('validate_completion');
            }
          }
          if (isExchangeCompleted() && !state.reviews.some(r => r.creator?.toString() === currentUser?.original_action_hash?.toString())) {
            actions.push('create_review');
          }
          if (state.cancellation && !state.cancellation.other_party_consent) {
            actions.push('respond_to_cancellation');
          }
          break;
          
        default:
          actions.push('view_only');
      }
    }
    
    state.availableActions = actions;
  }
  
  function getAvailableActions(): ExchangeAction[] {
    return state.availableActions;
  }
  
  function canUserPerformAction(action: ExchangeAction): boolean {
    return state.availableActions.includes(action);
  }
  
  // ============================================================================
  // STATUS CHECK METHODS
  // ============================================================================
  
  function isProposalPending(): boolean {
    return state.proposal?.status === 'Pending';
  }
  
  function isAgreementActive(): boolean {
    return state.agreement?.status === 'Active' || state.agreement?.status === 'InProgress';
  }
  
  function isExchangeCompleted(): boolean {
    return state.agreement?.status === 'Completed';
  }
  
  function isExchangeCancelled(): boolean {
    if (!state.agreement) return false;
    
    const cancelledStatuses = ['CancelledMutual', 'CancelledProvider', 'CancelledReceiver', 'Failed'];
    return cancelledStatuses.includes(state.agreement.status);
  }
  
  function needsUserValidation(): boolean {
    if (!state.agreement || !currentUser?.original_action_hash) return false;
    
    const userHash = currentUser.original_action_hash.toString();
    const userRole = state.userRole;
    
    // Check if the user needs to validate completion
    return state.agreement.status === 'InProgress' && 
           (userRole === 'provider' || userRole === 'receiver') &&
           !state.reviews.some(r => 
             r.creator?.toString() === userHash && 
             (r.provider_validation || r.receiver_validation)
           );
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  function getDisplayTitle(): string {
    if (state.proposal) {
      const typeLabel = state.proposal.proposal_type === 'DirectResponse' ? 'Direct Response' : 'Cross-Link Proposal';
      return `${typeLabel} - ${state.proposal.status}`;
    } else if (state.agreement) {
      return `Agreement - ${state.agreement.status}`;
    }
    return 'Exchange Details';
  }
  
  function getExchangeTimeline(): Array<{
    type: 'proposal' | 'agreement' | 'event' | 'review' | 'cancellation';
    data: any;
    timestamp: number;
    title: string;
    description: string;
  }> {
    const timeline: Array<{
      type: 'proposal' | 'agreement' | 'event' | 'review' | 'cancellation';
      data: any;
      timestamp: number;
      title: string;
      description: string;
    }> = [];
    
    // Add proposal to timeline
    if (state.proposal) {
      timeline.push({
        type: 'proposal',
        data: state.proposal,
        timestamp: state.proposal.created_at || 0,
        title: 'Proposal Created',
        description: `${state.proposal.proposal_type} proposal created`
      });
    }
    
    // Add agreement to timeline
    if (state.agreement) {
      timeline.push({
        type: 'agreement',
        data: state.agreement,
        timestamp: state.agreement.created_at || 0,
        title: 'Agreement Formed',
        description: 'Binding agreement created between parties'
      });
    }
    
    // Add events to timeline
    state.events.forEach(event => {
      timeline.push({
        type: 'event',
        data: event,
        timestamp: event.created_at || 0,
        title: typeof event.event_type === 'string' ? event.event_type : 
          typeof event.event_type === 'object' && 'Other' in event.event_type ? event.event_type.Other : 'Progress Update',
        description: event.description || 'Exchange progress updated'
      });
    });
    
    // Add reviews to timeline
    state.reviews.forEach(review => {
      timeline.push({
        type: 'review',
        data: review,
        timestamp: review.created_at || 0,
        title: review.is_public ? 'Public Review' : 'Validation',
        description: review.is_public ? 'Public review and rating posted' : 'Completion validation recorded'
      });
    });
    
    // Add cancellation to timeline
    if (state.cancellation) {
      timeline.push({
        type: 'cancellation',
        data: state.cancellation,
        timestamp: state.cancellation.created_at || 0,
        title: 'Cancellation',
        description: `Exchange cancellation: ${state.cancellation.reason}`
      });
    }
    
    // Sort by timestamp
    return timeline.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  function getUserDisplayRole(): string {
    const roleLabels: Record<typeof state.userRole, string> = {
      creator: "Proposal Creator",
      target: "Proposal Target",
      provider: "Service Provider",
      receiver: "Service Receiver",
      observer: "Observer"
    };
    
    return roleLabels[state.userRole];
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
    get proposal() {
      return state.proposal;
    },
    get agreement() {
      return state.agreement;
    },
    get events() {
      return state.events;
    },
    get reviews() {
      return state.reviews;
    },
    get cancellation() {
      return state.cancellation;
    },
    get relatedRequest() {
      return state.relatedRequest;
    },
    get relatedOffer() {
      return state.relatedOffer;
    },
    get userRole() {
      return state.userRole;
    },
    get availableActions() {
      return state.availableActions;
    },
    get hasInitialized() {
      return state.hasInitialized;
    },
    get isRefreshing() {
      return state.isRefreshing;
    },
    
    // Store state
    currentUser,
    storeLoading,
    storeError,
    isAdministrator,
    
    // Actions
    initialize,
    loadExchangeData,
    refreshExchangeData,
    getAvailableActions,
    canUserPerformAction,
    isProposalPending,
    isAgreementActive,
    isExchangeCompleted,
    isExchangeCancelled,
    needsUserValidation,
    loadRelatedEntities,
    loadExchangeHistory,
    getDisplayTitle,
    getExchangeTimeline,
    getUserDisplayRole
  };
}