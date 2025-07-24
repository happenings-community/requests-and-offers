import type { ActionHash } from '@holochain/client';
import type { UIRequest, BaseComposableState, UIUser } from '$lib/types/ui';
// Note: Using local error types for now during bridge implementation
import requestsStore from '$lib/stores/requests.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import administrationStore from '$lib/stores/administration.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast, isUserApproved } from '$lib/utils';
import { useModal } from '$lib/utils/composables';
import { Effect as E, Data, pipe } from 'effect';
import { page } from '$app/state';
import { goto } from '$app/navigation';

// Typed error for the composable
export class RequestsManagementError extends Data.TaggedError('RequestsManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): RequestsManagementError {
    if (error instanceof Error) {
      return new RequestsManagementError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new RequestsManagementError({
      message: String(error),
      context,
      cause: error
    });
  }
}

export interface RequestsManagementState extends BaseComposableState {
  filteredRequests: UIRequest[];
  filterType: 'all' | 'my' | 'organization';
  hasInitialized: boolean;
}

export interface RequestsManagementActions {
  initialize: () => Promise<void>;
  loadRequests: () => Promise<void>;
  deleteRequest: (requestHash: ActionHash) => Promise<void>;
  setFilterType: (filterType: 'all' | 'my' | 'organization') => void;
  getUserDisplayName: (user: UIUser | null) => string;
}

export interface UseRequestsManagement extends RequestsManagementState, RequestsManagementActions {
  requests: readonly UIRequest[];
  storeError: string | null;
  storeLoading: boolean;
  currentUser: UIUser | null;
  canCreateRequests: boolean;
}

export function useRequestsManagement(): UseRequestsManagement {
  const modal = useModal();

  // Initialize filter type from URL parameters
  const getInitialFilterType = (): 'all' | 'my' | 'organization' => {
    if (!page.url) return 'all';
    const filterParam = page.url.searchParams.get('filter');
    if (filterParam === 'my' || filterParam === 'organization') {
      return filterParam;
    }
    return 'all';
  };

  // State
  let state = $state<RequestsManagementState>({
    isLoading: true,
    error: null,
    filteredRequests: [],
    filterType: getInitialFilterType(),
    hasInitialized: false
  });

  // Track if we're programmatically changing the filter to avoid URL conflicts
  let isChangingFilterProgrammatically = false;

  // Handle URL parameter changes (only when not changing programmatically)
  $effect(() => {
    if (!page.url || isChangingFilterProgrammatically) return;

    const filterParam = page.url.searchParams.get('filter');
    if (filterParam === 'my' || filterParam === 'organization') {
      if (state.filterType !== filterParam) {
        state.filterType = filterParam;
      }
    } else if (filterParam === null && state.filterType !== 'all') {
      // If no filter parameter and current filter is not 'all', reset to 'all'
      state.filterType = 'all';
    }
  });

  // Reactive getters from stores
  const { requests, loading: storeLoading, error: storeError } = requestsStore;
  const { currentUser } = usersStore;
  const { agentIsAdministrator } = $derived(administrationStore);

  // Filter requests based on current filter type
  const filteredRequests = $derived.by(() => {
    if (!requests.length) return [];

    const filterFunctions = {
      my: (request: UIRequest) =>
        currentUser?.original_action_hash &&
        request.creator &&
        request.creator.toString() === currentUser.original_action_hash.toString(),

      organization: (request: UIRequest) =>
        currentUser?.organizations?.length! > 0 &&
        request.organization &&
        currentUser?.organizations?.some(
          (org) => org.toString() === request.organization?.toString()
        ),

      all: () => true
    };

    const filterFunction = filterFunctions[state.filterType] || filterFunctions.all;
    return requests.filter(filterFunction);
  });

  // Update state when filtered requests change
  $effect(() => {
    state.filteredRequests = filteredRequests;
  });

  // Load requests using pure Effect patterns - only for approved users
  const loadRequestsEffect = (): E.Effect<void, RequestsManagementError> =>
    pipe(
      E.sync(() => {
        state.isLoading = true;
        state.error = null;
      }),
      E.flatMap(() => {
        // Check user status and provide appropriate error messages
        if (!currentUser) {
          state.error =
            'Please create a user profile to view requests. You can find the "All Users" page under Community in the navigation menu.';
          return E.fail(
            new RequestsManagementError({
              message: 'No user profile found',
              context: 'loadRequests'
            })
          );
        }

        // Administrators can access requests even if they're not approved users
        if (!isUserApproved(currentUser) && !agentIsAdministrator) {
          // Different messages based on user status
          const status = currentUser.status?.status_type;
          let errorMessage = 'Access denied. Only approved users can view requests.';

          if (status === 'pending') {
            errorMessage =
              "Your profile is pending approval. You'll be able to view requests once an administrator approves your profile.";
          } else if (status === 'rejected') {
            errorMessage =
              'Your profile has been rejected. Please contact an administrator for more information.';
          } else if (status?.includes('suspended')) {
            errorMessage =
              'Your profile is currently suspended. Please contact an administrator for more information.';
          } else if (!status) {
            errorMessage =
              'Your profile needs to be reviewed by an administrator before you can view requests.';
          }

          state.error = errorMessage;
          return E.fail(
            new RequestsManagementError({
              message: errorMessage,
              context: 'loadRequests'
            })
          );
        }

        return pipe(
          requestsStore.getAllRequests(),
          E.mapError((error) => RequestsManagementError.fromError(error, 'getAllRequests'))
        );
      }),
      E.tap(() => {
        state.hasInitialized = true;
      }),
      E.asVoid,
      E.catchAll((error) => E.fail(RequestsManagementError.fromError(error, 'loadRequests'))),
      E.ensuring(
        E.sync(() => {
          state.isLoading = false;
        })
      )
    );

  // Load requests from the store
  async function loadRequests(): Promise<void> {
    try {
      await runEffect(loadRequestsEffect());
    } catch (error) {
      const requestsError = RequestsManagementError.fromError(error, 'loadRequests');
      state.error = requestsError.message;
      showToast('Failed to load requests', 'error');
    }
  }

  // Load initial data using Effect composition
  const initializeEffect = (): E.Effect<void, RequestsManagementError> =>
    pipe(
      loadRequestsEffect(),
      E.flatMap(() =>
        pipe(
          // Also refresh current user to ensure data is up-to-date
          usersStore.refreshCurrentUser(),
          E.catchAll((error) => {
            console.warn('Failed to refresh current user:', error);
            return E.void;
          })
        )
      )
    );

  async function initialize(): Promise<void> {
    if (state.hasInitialized) {
      return;
    }
    state.isLoading = true;
    try {
      await runEffect(initializeEffect());
    } catch (error) {
      const initError = RequestsManagementError.fromError(error, 'initialize');
      state.error = initError.message;
      showToast('Failed to initialize requests', 'error');
    } finally {
      state.isLoading = false;
    }
  }

  // Delete a request with confirmation
  async function deleteRequest(requestHash: ActionHash): Promise<void> {
    try {
      const confirmed = await modal.confirm(
        'Are you sure you want to delete this request?<br/>This action cannot be undone.',
        { confirmLabel: 'Delete', cancelLabel: 'Cancel' }
      );

      if (!confirmed) {
        return;
      }

      const deleteEffect = pipe(
        requestsStore.deleteRequest(requestHash),
        E.flatMap(() => loadRequestsEffect()),
        E.mapError((error) => RequestsManagementError.fromError(error, 'deleteRequest'))
      );

      await runEffect(deleteEffect);

      showToast('Request deleted successfully!', 'success');
    } catch (error) {
      const deleteError = RequestsManagementError.fromError(error, 'deleteRequest');
      showToast(deleteError.message, 'error');
      state.error = deleteError.message;
    }
  }

  // Set filter type and update URL
  function setFilterType(filterType: 'all' | 'my' | 'organization'): void {
    isChangingFilterProgrammatically = true;
    state.filterType = filterType;

    // Update URL to reflect the new filter
    const url = new URL(window.location.href);
    if (filterType === 'all') {
      url.searchParams.delete('filter');
    } else {
      url.searchParams.set('filter', filterType);
    }

    // Use replaceState to avoid adding to browser history
    const newUrl = url.pathname + (url.search ? url.search : '');
    goto(newUrl, { replaceState: true });

    // Reset the flag after a short delay
    setTimeout(() => {
      isChangingFilterProgrammatically = false;
    }, 0);
  }

  // Get user display name helper
  function getUserDisplayName(user: UIUser | null): string {
    if (!user) return 'Anonymous';
    return user.nickname || 'Anonymous';
  }

  // Check if user can create requests (accepted users or administrators)
  const canCreateRequests = $derived(
    currentUser?.status?.status_type === 'accepted' || agentIsAdministrator
  );

  // Return composable interface with proper reactivity
  return {
    // from state
    get isLoading() {
      return state.isLoading;
    },
    get error() {
      return state.error;
    },
    get filteredRequests() {
      return state.filteredRequests;
    },
    get filterType() {
      return state.filterType;
    },
    get hasInitialized() {
      return state.hasInitialized;
    },

    // from derived
    requests,
    storeError,
    storeLoading,
    currentUser,
    canCreateRequests,

    // actions
    initialize,
    loadRequests,
    deleteRequest,
    setFilterType,
    getUserDisplayName
  };
}
