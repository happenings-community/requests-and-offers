import type { ActionHash } from '@holochain/client';
import type { UIRequest, BaseComposableState, UIUser } from '$lib/types/ui';
// Note: Using local error types for now during bridge implementation
import requestsStore from '$lib/stores/requests.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';
import { useModal } from '$lib/utils/composables';
import { Effect as E, Data, pipe } from 'effect';
import { StoreEventBusLive } from '$lib/stores/storeEvents';

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

  // State
  let state = $state<RequestsManagementState>({
    isLoading: true,
    error: null,
    filteredRequests: [],
    filterType: 'all',
    hasInitialized: false
  });

  // Reactive getters from stores
  const { requests, loading: storeLoading, error: storeError } = requestsStore;
  const { currentUser } = usersStore;

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

  // Load requests using pure Effect patterns
  const loadRequestsEffect = (): E.Effect<void, RequestsManagementError> =>
    pipe(
      E.sync(() => {
        state.isLoading = true;
        state.error = null;
      }),
      E.flatMap(() =>
        pipe(
          requestsStore.getAllRequests(),
          E.mapError((error) => RequestsManagementError.fromError(error, 'getAllRequests'))
        )
      ),
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
          E.tryPromise({
            try: () => usersStore.refreshCurrentUser(),
            catch: (error) => error
          }),
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

      await runEffect(pipe(deleteEffect, E.provide(StoreEventBusLive)));

      showToast('Request deleted successfully!', 'success');
    } catch (error) {
      const deleteError = RequestsManagementError.fromError(error, 'deleteRequest');
      showToast(deleteError.message, 'error');
      state.error = deleteError.message;
    }
  }

  // Set filter type
  function setFilterType(filterType: 'all' | 'my' | 'organization'): void {
    state.filterType = filterType;
  }

  // Get user display name helper
  function getUserDisplayName(user: UIUser | null): string {
    if (!user) return 'Anonymous';
    return user.nickname || 'Anonymous';
  }

  // Check if user can create requests
  const canCreateRequests = $derived(currentUser?.status?.status_type === 'accepted');

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
