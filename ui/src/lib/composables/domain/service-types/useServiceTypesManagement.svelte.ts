import { getModalStore } from '@skeletonlabs/skeleton';
import type { ActionHash } from '@holochain/client';
import type { UIServiceType, BaseComposableState, ConfirmModalMeta } from '$lib/types/ui';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import administrationStore from '$lib/stores/administration.store.svelte';
import { ServiceTypeError } from '$lib/errors';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';
import { useModal } from '$lib/utils/composables';
import { useErrorBoundary } from '$lib/composables/ui/useErrorBoundary.svelte';
import { Effect as E, pipe } from 'effect';
import { createMockedServiceTypes } from '$lib/utils/mocks';
import { SERVICE_TYPE_CONTEXTS, ErrorHandling, ErrorRecovery } from '$lib/errors';
import { withFormToast, withErrorToast } from '$lib/utils/errorToastMiddleware';

export interface ServiceTypesManagementState extends BaseComposableState {
  filteredServiceTypes: UIServiceType[];
  searchKey: number;
}

export interface ServiceTypesManagementActions {
  initialize: () => Promise<void>;
  loadServiceTypes: () => Promise<void>;
  deleteServiceType: (serviceTypeHash: ActionHash) => void;
  createMockServiceTypes: () => void;
  handleFilteredResultsChange: (filtered: UIServiceType[]) => void;
}

export interface UseServiceTypesManagement
  extends ServiceTypesManagementState,
    ServiceTypesManagementActions {
  serviceTypes: readonly UIServiceType[];
  pendingCount: number;
  storeError: string | null;
  loadingErrorBoundary: ReturnType<typeof useErrorBoundary>;
  deleteErrorBoundary: ReturnType<typeof useErrorBoundary>;
}

export function useServiceTypesManagement(): UseServiceTypesManagement {
  const modal = useModal();

  // Access admin status from the administration store
  const { agentIsAdministrator } = $derived(administrationStore);

  // Error boundaries for different operations
  const loadingErrorBoundary = useErrorBoundary({
    context: SERVICE_TYPE_CONTEXTS.FETCH_SERVICE_TYPES,
    enableLogging: true,
    enableToast: false, // Use custom toast handling
    enableFallback: true,
    maxRetries: 2,
    retryDelay: 1000
  });

  const deleteErrorBoundary = useErrorBoundary({
    context: SERVICE_TYPE_CONTEXTS.DELETE_SERVICE_TYPE,
    enableLogging: true,
    enableToast: false,
    maxRetries: 1
  });

  // State
  const state = $state<ServiceTypesManagementState>({
    isLoading: true,
    error: null,
    filteredServiceTypes: [],
    searchKey: 0
  });

  // Track the last known serviceTypes length to avoid infinite loops
  let lastServiceTypesLength = $state(0);

  // Reactive getters from store
  const {
    approvedServiceTypes,
    pendingServiceTypes,
    error: storeError
  } = $derived(serviceTypesStore);

  // Deduplicate service types by original_action_hash to prevent duplicate keys
  const serviceTypes = $derived(
    (() => {
      // In public mode or approved-only mode, only show approved service types
      const deduplicatedMap = new Map<string, UIServiceType>();

      approvedServiceTypes.forEach((serviceType) => {
        const key = serviceType.original_action_hash?.toString();
        if (key && !deduplicatedMap.has(key)) {
          deduplicatedMap.set(key, serviceType);
        }
      });

      return Array.from(deduplicatedMap.values());
    })()
  );

  const pendingCount = $derived(pendingServiceTypes.length);

  // Initialize filtered service types when base service types change
  $effect(() => {
    if (serviceTypes.length > 0 && serviceTypes.length !== lastServiceTypesLength) {
      // Update filteredServiceTypes only if search component hasn't set them yet
      if (state.filteredServiceTypes.length === 0) {
        state.filteredServiceTypes = [...serviceTypes];
      }
      // Only increment searchKey if the length actually changed
      if (lastServiceTypesLength !== serviceTypes.length) {
        state.searchKey++;
        lastServiceTypesLength = serviceTypes.length;
      }
    }
  });

  // Load service types using enhanced error handling
  const loadServiceTypesEffect = (): E.Effect<void, ServiceTypeError> =>
    pipe(
      E.sync(() => {
        state.isLoading = true;
        state.error = null;
      }),
      E.flatMap(() => {
        // Always load approved service types (public)
        const approvedEffect = pipe(
          ErrorHandling.withLogging(
            ErrorHandling.withRetry(serviceTypesStore.getApprovedServiceTypes()),
            SERVICE_TYPE_CONTEXTS.GET_ALL_SERVICE_TYPES
          ),
          E.mapError((error) =>
            ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_APPROVED_SERVICE_TYPES)
          )
        );

        // Only load pending service types for admin users
        const pendingEffect = agentIsAdministrator
          ? pipe(
              ErrorHandling.withLogging(
                ErrorHandling.withRetry(serviceTypesStore.getPendingServiceTypes()),
                SERVICE_TYPE_CONTEXTS.GET_ALL_SERVICE_TYPES
              ),
              E.mapError((error) =>
                ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_PENDING_SERVICE_TYPES)
              ),
              E.catchAll((error) => {
                console.warn('Failed to load pending service types (admin user):', error);
                return E.succeed([] as UIServiceType[]);
              })
            )
          : E.succeed([] as UIServiceType[]); // Return empty array for non-admin users

        return E.all([approvedEffect, pendingEffect]).pipe(
          E.map(() => void 0) // Convert to void since we don't need the return value
        );
      }),
      E.tap(() => {
        // Force re-initialization of filtered service types only if we're not in a creation process
        if (!state.isLoading) {
          state.filteredServiceTypes = [...serviceTypes];
        }
      }),
      E.asVoid,
      E.catchAll((error) =>
        E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.FETCH_SERVICE_TYPES))
      ),
      E.ensuring(
        E.sync(() => {
          state.isLoading = false;
        })
      )
    );

  // Load service types using error boundary
  async function loadServiceTypes(): Promise<void> {
    const result = await loadingErrorBoundary.execute(
      loadServiceTypesEffect(),
      undefined // no fallback needed for void operation
    );

    if (loadingErrorBoundary.state.error) {
      state.error =
        typeof loadingErrorBoundary.state.error === 'object' &&
        loadingErrorBoundary.state.error !== null &&
        'message' in loadingErrorBoundary.state.error
          ? (loadingErrorBoundary.state.error as any).message || 'Failed to load service types'
          : 'Failed to load service types';
    }
  }

  // Load initial data using Effect composition
  const initializeEffect = (): E.Effect<void, ServiceTypeError> => loadServiceTypesEffect();

  async function initialize(): Promise<void> {
    return runEffect(initializeEffect());
  }

  // Delete a service type with enhanced error handling and toast notifications
  const deleteServiceTypeEffect = (serviceTypeHash: ActionHash): E.Effect<void, ServiceTypeError> =>
    pipe(
      E.tryPromise({
        try: () =>
          modal.confirm(
            'Are you sure you want to delete this service type?<br/>This action cannot be undone.',
            { confirmLabel: 'Delete', cancelLabel: 'Cancel' }
          ),
        catch: (error) =>
          ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.DELETE_SERVICE_TYPE)
      }),
      E.flatMap((confirmed) => {
        if (!confirmed) return E.void;

        return pipe(
          ErrorHandling.withLogging(
            withFormToast(
              serviceTypesStore.deleteServiceType(serviceTypeHash),
              'delete',
              'Service type'
            ),
            SERVICE_TYPE_CONTEXTS.DELETE_SERVICE_TYPE
          ),
          E.mapError((error) =>
            ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.DELETE_SERVICE_TYPE)
          ),
          E.flatMap(() => loadServiceTypesEffect())
        );
      })
    );

  async function deleteServiceType(serviceTypeHash: ActionHash): Promise<void> {
    await deleteErrorBoundary.execute(
      deleteServiceTypeEffect(serviceTypeHash),
      undefined // no fallback needed for void operation
    );
  }

  // Create mock service types using Effect composition with forEach
  const createMockServiceTypesEffect = (): E.Effect<void, ServiceTypeError> =>
    pipe(
      E.tryPromise({
        try: () =>
          modal.confirm('This will create 5 mock service types for testing.<br/>Continue?', {
            confirmLabel: 'Create',
            cancelLabel: 'Cancel'
          }),
        catch: (error) =>
          ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE)
      }),
      E.flatMap((confirmed) => {
        if (!confirmed) return E.void;

        return pipe(
          E.sync(() => {
            state.isLoading = true;
          }),
          E.flatMap(() =>
            E.tryPromise({
              try: () => createMockedServiceTypes(5),
              catch: (error) =>
                ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE)
            })
          ),
          E.flatMap((mockServiceTypes) =>
            pipe(
              E.forEach(mockServiceTypes, (serviceType) =>
                pipe(
                  serviceTypesStore.createServiceType(serviceType),
                  E.mapError((error) =>
                    ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE)
                  )
                )
              ),
              E.flatMap(() =>
                E.all([
                  pipe(
                    serviceTypesStore.getApprovedServiceTypes(),
                    E.mapError((error) =>
                      ServiceTypeError.fromError(
                        error,
                        SERVICE_TYPE_CONTEXTS.GET_APPROVED_SERVICE_TYPES
                      )
                    )
                  ),
                  pipe(
                    serviceTypesStore.getPendingServiceTypes(),
                    E.mapError((error) =>
                      ServiceTypeError.fromError(
                        error,
                        SERVICE_TYPE_CONTEXTS.GET_PENDING_SERVICE_TYPES
                      )
                    )
                  )
                ])
              ),
              E.tap(() => {
                // Force search component update
                state.searchKey++;
                showToast(`${mockServiceTypes.length} mock service types created successfully`);
              })
            )
          )
        );
      }),
      E.ensuring(
        E.sync(() => {
          state.isLoading = false;
        })
      )
    );

  function createMockServiceTypes(): void {
    pipe(
      createMockServiceTypesEffect(),
      E.catchAll((error) =>
        E.sync(() => showToast(`Failed to create mock service types: ${error.message}`, 'error'))
      ),
      E.orElse(() => E.void),
      runEffect
    );
  }

  // Handle filtered results change from search component
  function handleFilteredResultsChange(filtered: UIServiceType[]): void {
    state.filteredServiceTypes = filtered;
  }

  return {
    // from state
    get isLoading() {
      return state.isLoading;
    },
    get error() {
      return state.error;
    },
    get filteredServiceTypes() {
      return state.filteredServiceTypes;
    },
    get searchKey() {
      return state.searchKey;
    },

    // from derived
    get serviceTypes() {
      return serviceTypes;
    },
    get pendingCount() {
      return pendingCount;
    },
    get storeError() {
      return storeError;
    },

    // error boundaries for components to access
    loadingErrorBoundary,
    deleteErrorBoundary,

    // actions
    initialize,
    loadServiceTypes,
    deleteServiceType,
    createMockServiceTypes,
    handleFilteredResultsChange
  };
}
