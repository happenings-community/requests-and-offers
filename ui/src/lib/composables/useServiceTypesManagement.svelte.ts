import { getModalStore } from '@skeletonlabs/skeleton';
import type { ActionHash } from '@holochain/client';
import type { UIServiceType } from '$lib/types/ui';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { Effect as E, Data, pipe } from 'effect';
import { createMockedServiceTypes } from '$lib/utils/mocks';
import type { ConfirmModalMeta } from '$lib/types/ui';
import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
import { showToast } from '$lib/utils';

// Typed error for the composable
export class ServiceTypesManagementError extends Data.TaggedError('ServiceTypesManagementError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ServiceTypesManagementError {
    if (error instanceof Error) {
      return new ServiceTypesManagementError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new ServiceTypesManagementError({
      message: String(error),
      context,
      cause: error
    });
  }
}

export interface ServiceTypesManagementState {
  isLoading: boolean;
  error: string | null;
  filteredServiceTypes: UIServiceType[];
  searchKey: number;
}

export function useServiceTypesManagement() {
  const modalStore = getModalStore();

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
      const combined = [...approvedServiceTypes, ...pendingServiceTypes];
      const deduplicatedMap = new Map<string, UIServiceType>();

      combined.forEach((serviceType) => {
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

  // Reusable Effect for modal confirmation
  const showConfirmModal = (
    message: string,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel'
  ): E.Effect<boolean, never> =>
    E.promise<boolean>(
      () =>
        new Promise((resolve) => {
          modalStore.trigger({
            type: 'component',
            component: { ref: ConfirmModal },
            meta: {
              message,
              confirmLabel,
              cancelLabel
            } as ConfirmModalMeta,
            response: (confirmed: boolean) => resolve(confirmed)
          });
        })
    );

  // Load service types using pure Effect patterns
  const loadServiceTypesEffect = (): E.Effect<void, ServiceTypesManagementError> =>
    pipe(
      E.sync(() => {
        state.isLoading = true;
        state.error = null;
      }),
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
            E.catchAll(() => {
              console.warn('Failed to load pending service types');
              return E.succeed([] as UIServiceType[]);
            })
          )
        ])
      ),
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
          showToast('Failed to load service types', 'error'),
          E.flatMap(() => {
            state.error = error.message;
            return E.fail(error);
          })
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
            console.error('Failed to load tags:', error);
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
      showConfirmModal(
        'Are you sure you want to delete this service type?<br/>This action cannot be undone.',
        'Delete',
        'Cancel'
      ),
      E.flatMap((confirmed) => {
        if (!confirmed) return E.void;

        return pipe(
          serviceTypesStore.deleteServiceType(serviceTypeHash),
          E.mapError((error) => ServiceTypesManagementError.fromError(error, 'deleteServiceType')),
          E.flatMap(() => loadServiceTypesEffect()),
          E.flatMap(() => showToast('Service type deleted successfully'))
        );
      }),
      E.catchAll((error) =>
        pipe(
          showToast(`Failed to delete service type: ${error}`, 'error'),
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
      showConfirmModal(
        'This will create 5 mock service types for testing.<br/>Continue?',
        'Create',
        'Cancel'
      ),
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
              }),
              E.flatMap(() =>
                showToast(`${mockServiceTypes.length} mock service types created successfully`)
              )
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
        pipe(
          showToast(`Failed to create mock service types: ${error.message}`, 'error'),
          E.orElse(() => E.void)
        )
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
    // State
    get state() {
      return state;
    },
    get serviceTypes() {
      return serviceTypes;
    },
    get pendingCount() {
      return pendingCount;
    },
    get storeError() {
      return storeError;
    },

    // Actions
    initialize,
    loadServiceTypes,
    deleteServiceType,
    createMockServiceTypes,
    handleFilteredResultsChange
  };
}
