import { getModalStore } from '@skeletonlabs/skeleton';
import type { ActionHash } from '@holochain/client';
import type { UIServiceType, BaseComposableState, ConfirmModalMeta } from '$lib/types/ui';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import { ServiceTypesManagementError } from '$lib/errors/service-types.errors';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';
import { useModal } from '$lib/utils/composables';
import { Effect as E, pipe } from 'effect';
import { createMockedServiceTypes } from '$lib/utils/mocks';

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
}

export function useServiceTypesManagement(): UseServiceTypesManagement {
  const modal = useModal();

  // State
  let state = $state<ServiceTypesManagementState>({
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

  // Load service types using pure Effect patterns
  const loadServiceTypesEffect = (): E.Effect<void, ServiceTypesManagementError> =>
    pipe(
      E.sync(() => {
        state.isLoading = true;
        state.error = null;
      }),
      E.flatMap(() => {
        // In admin mode (including approvedOnly), fetch both approved and pending service types
        // This ensures admin features like pending count work correctly
        return E.all([
          pipe(
            serviceTypesStore.getApprovedServiceTypes(),
            E.mapError((error) =>
              ServiceTypesManagementError.fromError(error, 'getApprovedServiceTypes')
            )
          ),
          pipe(
            serviceTypesStore.getPendingServiceTypes(),
            E.catchAll((error) => {
              // Don't show errors for pending service types if user is not authorized
              // This allows non-admin users and users without profiles to still see approved service types
              console.warn(
                'Failed to load pending service types (this is normal for non-admin users):',
                error
              );
              return E.succeed([] as UIServiceType[]);
            })
          )
        ]).pipe(E.map(() => void 0)); // Convert to void since we don't need the return value
      }),
      E.tap(() => {
        // Force re-initialization of filtered service types only if we're not in a creation process
        if (!state.isLoading) {
          state.filteredServiceTypes = [...serviceTypes];
        }
      }),
      E.asVoid,
      E.catchAll((error) =>
        E.fail(ServiceTypesManagementError.fromError(error, 'loadServiceTypes'))
      ),
      E.ensuring(
        E.sync(() => {
          state.isLoading = false;
        })
      )
    );

  // Load service types from the store
  async function loadServiceTypes(): Promise<void> {
    return pipe(
      loadServiceTypesEffect(),
      E.catchAll((error) =>
        pipe(
          E.sync(() => showToast('Failed to load service types', 'error')),
          E.tap(() => {
            state.error = error.message;
          }),
          E.flatMap(() => E.fail(error))
        )
      ),
      E.orElse(() => E.void),
      runEffect
    );
  }

  // Load initial data including tags using Effect composition
  const initializeEffect = (): E.Effect<void, ServiceTypesManagementError> =>
    pipe(
      loadServiceTypesEffect(),
      E.flatMap(() =>
        pipe(
          serviceTypesStore.loadAllTags(),
          E.catchAll((error) => {
            // Gracefully handle tag loading errors for users without profiles
            console.warn('Failed to load tags (this is normal for users without profiles):', error);
            return E.void;
          })
        )
      )
    );

  async function initialize(): Promise<void> {
    return runEffect(initializeEffect());
  }

  // Delete a service type with confirmation using Effect composition
  const deleteServiceTypeEffect = (
    serviceTypeHash: ActionHash
  ): E.Effect<void, ServiceTypesManagementError> =>
    pipe(
      E.tryPromise({
        try: () =>
          modal.confirm(
            'Are you sure you want to delete this service type?<br/>This action cannot be undone.',
            { confirmLabel: 'Delete', cancelLabel: 'Cancel' }
          ),
        catch: (error) => ServiceTypesManagementError.fromError(error, 'confirmDialog')
      }),
      E.flatMap((confirmed) => {
        if (!confirmed) return E.void;

        return pipe(
          serviceTypesStore.deleteServiceType(serviceTypeHash),
          E.mapError((error) => ServiceTypesManagementError.fromError(error, 'deleteServiceType')),
          E.flatMap(() => loadServiceTypesEffect()),
          E.tap(() => showToast('Service type deleted successfully'))
        );
      }),
      E.catchAll((error) =>
        pipe(
          E.sync(() => showToast(`Failed to delete service type: ${error}`, 'error')),
          E.flatMap(() => E.fail(ServiceTypesManagementError.fromError(error, 'deleteServiceType')))
        )
      )
    );

  function deleteServiceType(serviceTypeHash: ActionHash): void {
    pipe(
      deleteServiceTypeEffect(serviceTypeHash),
      E.orElse(() => E.void), // Ignore errors after toast notification
      runEffect
    );
  }

  // Create mock service types using Effect composition with forEach
  const createMockServiceTypesEffect = (): E.Effect<void, ServiceTypesManagementError> =>
    pipe(
      E.tryPromise({
        try: () =>
          modal.confirm('This will create 5 mock service types for testing.<br/>Continue?', {
            confirmLabel: 'Create',
            cancelLabel: 'Cancel'
          }),
        catch: (error) => ServiceTypesManagementError.fromError(error, 'confirmDialog')
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
                ServiceTypesManagementError.fromError(error, 'createMockServiceTypes')
            })
          ),
          E.flatMap((mockServiceTypes) =>
            pipe(
              E.forEach(mockServiceTypes, (serviceType) =>
                pipe(
                  serviceTypesStore.createServiceType(serviceType),
                  E.mapError((error) =>
                    ServiceTypesManagementError.fromError(error, 'createServiceType')
                  )
                )
              ),
              E.flatMap(() =>
                E.all([
                  pipe(
                    serviceTypesStore.getApprovedServiceTypes(),
                    E.mapError((error) =>
                      ServiceTypesManagementError.fromError(error, 'getApprovedServiceTypes')
                    )
                  ),
                  pipe(
                    serviceTypesStore.getPendingServiceTypes(),
                    E.mapError((error) =>
                      ServiceTypesManagementError.fromError(error, 'getPendingServiceTypes')
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

    // actions
    initialize,
    loadServiceTypes,
    deleteServiceType,
    createMockServiceTypes,
    handleFilteredResultsChange
  };
}
