import { getToastStore, getModalStore } from '@skeletonlabs/skeleton';
import type { ActionHash } from '@holochain/client';
import type { UIServiceType } from '$lib/types/ui';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { Effect as E } from 'effect';
import { createMockedServiceTypes } from '$lib/utils/mocks';
import type { ConfirmModalMeta } from '$lib/types/ui';
import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';

export interface ServiceTypesManagementState {
  isLoading: boolean;
  error: string | null;
  filteredServiceTypes: UIServiceType[];
  searchKey: number;
}

export function useServiceTypesManagement() {
  const toastStore = getToastStore();
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
  const serviceTypes = $derived([...approvedServiceTypes, ...pendingServiceTypes]);
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

  // Load service types from the store
  async function loadServiceTypes(): Promise<void> {
    state.isLoading = true;
    state.error = null;

    try {
      await Promise.all([
        runEffect(serviceTypesStore.getApprovedServiceTypes()),
        runEffect(serviceTypesStore.getPendingServiceTypes()).catch((error) => {
          console.warn('Failed to load pending service types:', error);
        })
      ]);

      // Force re-initialization of filtered service types only if we're not in a creation process
      if (!state.isLoading) {
        state.filteredServiceTypes = [...serviceTypes];
      }
    } catch (error) {
      console.error('Error loading service types:', error);
      state.error = error instanceof Error ? error.message : 'Failed to load service types';

      toastStore.trigger({
        message: 'Failed to load service types',
        background: 'variant-filled-error'
      });
    } finally {
      state.isLoading = false;
    }
  }

  // Load initial data including tags
  async function initialize(): Promise<void> {
    await loadServiceTypes();

    try {
      await runEffect(serviceTypesStore.loadAllTags());
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  }

  // Delete a service type with confirmation
  function deleteServiceType(serviceTypeHash: ActionHash): void {
    const confirmEffect = E.gen(function* () {
      const confirmed = yield* E.promise<boolean>(
        () =>
          new Promise((resolve) => {
            modalStore.trigger({
              type: 'component',
              component: { ref: ConfirmModal },
              meta: {
                message:
                  'Are you sure you want to delete this service type?<br/>This action cannot be undone.',
                confirmLabel: 'Delete',
                cancelLabel: 'Cancel'
              } as ConfirmModalMeta,
              response: (confirmed: boolean) => resolve(confirmed)
            });
          })
      );

      if (!confirmed) return;

      yield* serviceTypesStore.deleteServiceType(serviceTypeHash);
      yield* E.promise(() => loadServiceTypes());

      toastStore.trigger({
        message: 'Service type deleted successfully',
        background: 'variant-filled-success'
      });
    });

    const effectWithErrorHandling = E.catchAll(confirmEffect, (error) =>
      E.sync(() => {
        toastStore.trigger({
          message: `Failed to delete service type: ${error}`,
          background: 'variant-filled-error'
        });
      })
    );

    runEffect(effectWithErrorHandling);
  }

  // Create mock service types for testing
  function createMockServiceTypes(): void {
    const createMockEffect = E.gen(function* () {
      const confirmed = yield* E.promise<boolean>(
        () =>
          new Promise((resolve) => {
            modalStore.trigger({
              type: 'component',
              component: { ref: ConfirmModal },
              meta: {
                message: 'This will create 5 mock service types for testing.<br/>Continue?',
                confirmLabel: 'Create',
                cancelLabel: 'Cancel'
              } as ConfirmModalMeta,
              response: (confirmed: boolean) => resolve(confirmed)
            });
          })
      );

      if (!confirmed) return;

      state.isLoading = true;

      const mockServiceTypes = yield* E.promise(() => createMockedServiceTypes(5));

      // Create each mock service type
      for (const serviceType of mockServiceTypes) {
        yield* serviceTypesStore.createServiceType(serviceType);
      }

      // Manually refresh the data to avoid reactive loops
      yield* E.all([
        serviceTypesStore.getApprovedServiceTypes(),
        serviceTypesStore.getPendingServiceTypes()
      ]);

      // Force search component update
      state.searchKey++;

      toastStore.trigger({
        message: `${mockServiceTypes.length} mock service types created successfully`,
        background: 'variant-filled-success'
      });
    });

    const effectWithErrorHandling = E.catchAll(createMockEffect, (error) =>
      E.sync(() => {
        toastStore.trigger({
          message: `Failed to create mock service types: ${error}`,
          background: 'variant-filled-error'
        });
      })
    );

    const finalEffect = E.ensuring(
      effectWithErrorHandling,
      E.sync(() => {
        state.isLoading = false;
      })
    );

    runEffect(finalEffect);
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
