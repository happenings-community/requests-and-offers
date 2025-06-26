import { Effect as E, pipe, Data } from 'effect';
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
import type { ActionHash } from '@holochain/client';
import type { UIRequest, UIUser, UIOrganization } from '$lib/types/ui';
import requestsStore from '$lib/stores/requests.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';

/**
 * Request Details Error
 */
export class RequestDetailsError extends Data.TaggedError('RequestDetailsError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): RequestDetailsError {
    if (error instanceof Error) {
      return new RequestDetailsError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new RequestDetailsError({
      message: String(error),
      context,
      cause: error
    });
  }
}

/**
 * Request Details State
 */
export interface RequestDetailsState {
  // Core state
  isLoading: boolean;
  error: string | null;
  request: UIRequest | null;

  // Related data
  creator: UIUser | null;
  organization: UIOrganization | null;
  serviceTypeHashes: ActionHash[];

  // Page context
  requestId: string | undefined;

  // Permissions
  canEdit: boolean;
}

/**
 * Request Details Actions
 */
export interface RequestDetailsActions {
  // Navigation
  navigateBack: () => void;
  navigateToEdit: () => void;
  navigateToRequests: () => void;

  // CRUD operations
  deleteRequest: (confirmer?: () => Promise<boolean>) => Promise<void>;
  refreshData: () => Promise<void>;

  // Utilities
  getEncodedHash: () => string | null;
  checkEditPermissions: () => boolean;
}

/**
 * Combined interface for the request details composable
 */
export interface UseRequestDetails extends RequestDetailsState, RequestDetailsActions {}

/**
 * Options for the request details composable
 */
export interface UseRequestDetailsOptions {
  backRoute?: string;
  onDeleted?: () => void;
  onError?: (error: RequestDetailsError) => void;
}

/**
 * Request Details Composable
 *
 * This composable handles:
 * 1. URL parameter parsing and hash decoding
 * 2. Request loading with parallel related data fetching (creator, organization)
 * 3. Permission checking for edit/delete operations
 * 4. Navigation helpers (back, edit, requests list)
 * 5. Delete operations (confirmation handled by caller)
 * 6. Loading and error state management
 * 7. Service type hash management
 *
 * Eliminates 150+ lines of boilerplate from detail pages
 */
export function useRequestDetails(options: UseRequestDetailsOptions = {}): UseRequestDetails {
  const { backRoute = '/requests', onDeleted, onError } = options;

  // Page context
  const requestId = $derived(page.params.id);

  // Core state
  let state = $state<Omit<RequestDetailsState, 'requestId' | 'canEdit'>>({
    isLoading: true,
    error: null,
    request: null,
    creator: null,
    organization: null,
    serviceTypeHashes: []
  });

  // Current user for permission checking
  const { currentUser } = $derived(usersStore);

  // Check edit permissions
  const canEdit = $derived.by(() => {
    if (!currentUser || !state.request) return false;

    // User can edit if they created the request
    if (state.request.creator && currentUser.original_action_hash) {
      return state.request.creator.toString() === currentUser.original_action_hash.toString();
    }

    // User can edit if they are an organization coordinator
    if (state.request.organization && state.organization?.coordinators) {
      return state.organization.coordinators.some(
        (coord) => coord.toString() === currentUser.original_action_hash?.toString()
      );
    }

    return false;
  });

  // Load request with related data effect
  const loadRequestDataEffect = (): E.Effect<UIRequest, RequestDetailsError> =>
    pipe(
      E.sync(() => {
        if (!requestId) {
          throw new Error('Invalid request ID');
        }
        return decodeHashFromBase64(requestId);
      }),
      E.flatMap((requestHash) =>
        pipe(
          requestsStore.getLatestRequest(requestHash),
          E.mapError((error) => RequestDetailsError.fromError(error, 'getLatestRequest'))
        )
      ),
      E.tap((fetchedRequest) => {
        if (!fetchedRequest) {
          return E.fail(
            new RequestDetailsError({
              message: 'Request not found',
              context: 'loadRequestData'
            })
          );
        }
        return E.void;
      }),
      E.map((fetchedRequest) => {
        if (!fetchedRequest) {
          throw new Error('Request not found'); // This shouldn't happen due to tap above
        }
        return fetchedRequest;
      })
    );

  // Load related data (creator, organization) effect
  const loadRelatedDataEffect = (request: UIRequest): E.Effect<void, RequestDetailsError> => {
    const parallelEffects: Record<string, E.Effect<any, any, any>> = {};

    // Load creator if available
    if (request.creator) {
      parallelEffects.creator = pipe(
        E.tryPromise({
          try: () => {
            if (!request.creator) throw new Error('Creator hash is undefined');
            return usersStore.getUserByActionHash(request.creator);
          },
          catch: (err) => RequestDetailsError.fromError(err, 'fetchCreator')
        }),
        E.tap((user) =>
          E.sync(() => {
            state.creator = user;
          })
        )
      );
    }

    // Load organization if available
    if (request.organization) {
      parallelEffects.organization = pipe(
        E.tryPromise({
          try: () => {
            if (!request.organization) throw new Error('Organization hash is undefined');
            return organizationsStore.getOrganizationByActionHash(request.organization);
          },
          catch: (err) => RequestDetailsError.fromError(err, 'fetchOrganization')
        }),
        E.tap((org) =>
          E.sync(() => {
            state.organization = org;
          })
        )
      );
    }

    // Set service type hashes
    if (request.service_type_hashes) {
      state.serviceTypeHashes = request.service_type_hashes;
    }

    // Execute parallel effects if any
    if (Object.keys(parallelEffects).length > 0) {
      return pipe(
        E.all(parallelEffects),
        E.mapError((error) => RequestDetailsError.fromError(error, 'loadRelatedData')),
        E.asVoid
      ) as E.Effect<void, RequestDetailsError, never>;
    }

    return E.void;
  };

  // Combined load effect
  const loadAllDataEffect = (): E.Effect<void, RequestDetailsError> =>
    pipe(
      loadRequestDataEffect(),
      E.tap((request) => {
        state.request = request;
        return E.void;
      }),
      E.flatMap((request) => loadRelatedDataEffect(request))
    );

  // Load request data
  async function loadRequestData(): Promise<void> {
    state.isLoading = true;
    state.error = null;

    try {
      await pipe(loadAllDataEffect(), runEffect);
    } catch (error) {
      const requestError = RequestDetailsError.fromError(error, 'loadRequestData');
      state.error = requestError.message;
      onError?.(requestError);
      console.error('Failed to load request:', error);
    } finally {
      state.isLoading = false;
    }
  }

  // Auto-load on mount and when requestId changes
  $effect(() => {
    if (requestId) {
      // Use setTimeout to prevent UI freezing during initial render
      setTimeout(() => {
        loadRequestData();
      }, 0);
    }
  });

  // Navigation functions
  function navigateBack(): void {
    goto(backRoute);
  }

  function navigateToEdit(): void {
    if (requestId) {
      goto(`/requests/${requestId}/edit`);
    }
  }

  function navigateToRequests(): void {
    goto('/requests');
  }

  // Delete with optional confirmation
  async function deleteRequest(confirmer?: () => Promise<boolean>): Promise<void> {
    if (!state.request?.original_action_hash) {
      pipe(showToast('Cannot delete request: missing action hash', 'error'), runEffect);
      return;
    }

    try {
      // If a confirmer function is provided, use it for confirmation
      if (confirmer) {
        const confirmed = await confirmer();
        if (!confirmed) return;
      }

      await pipe(
        requestsStore.deleteRequest(state.request.original_action_hash),
        E.mapError((error) => RequestDetailsError.fromError(error, 'deleteRequest')),
        runEffect
      );

      pipe(showToast('Request deleted successfully!', 'success'), runEffect);
      onDeleted?.();
      navigateToRequests();
    } catch (error) {
      const deleteError = RequestDetailsError.fromError(error, 'deleteRequest');
      pipe(showToast(`Failed to delete request: ${deleteError.message}`, 'error'), runEffect);
      onError?.(deleteError);
    }
  }

  // Refresh data
  async function refreshData(): Promise<void> {
    await loadRequestData();
  }

  // Get encoded hash for external use
  function getEncodedHash(): string | null {
    if (!state.request?.original_action_hash) return null;
    return encodeHashToBase64(state.request.original_action_hash);
  }

  // Check edit permissions manually
  function checkEditPermissions(): boolean {
    return canEdit;
  }

  return {
    // State getters
    get isLoading() {
      return state.isLoading;
    },
    get error() {
      return state.error;
    },
    get request() {
      return state.request;
    },
    get creator() {
      return state.creator;
    },
    get organization() {
      return state.organization;
    },
    get serviceTypeHashes() {
      return state.serviceTypeHashes;
    },
    get requestId() {
      return requestId;
    },
    get canEdit() {
      return canEdit;
    },

    // Actions
    navigateBack,
    navigateToEdit,
    navigateToRequests,
    deleteRequest,
    refreshData,
    getEncodedHash,
    checkEditPermissions
  };
}
