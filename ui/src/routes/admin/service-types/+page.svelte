<script lang="ts">
  import { onMount } from 'svelte';
  import { getToastStore, getModalStore } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIServiceType } from '$lib/types/ui';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';
  import ServiceTypeSearch from '$lib/components/service-types/ServiceTypeSearch.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { encodeHashToBase64 } from '@holochain/client';
  import { Effect as E } from 'effect';
  import { createMockedServiceTypes } from '$lib/utils/mocks';
  import type { ConfirmModalMeta } from '$lib/types/ui';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';

  const toastStore = getToastStore();
  const modalStore = getModalStore();

  let pageState = $state({
    isLoading: true,
    error: null as string | null
  });

  // Reactive getters from store (avoiding loading state to prevent reactive loops)
  const { approvedServiceTypes, pendingServiceTypes, error: storeError } = $derived(serviceTypesStore);
  // For admin page, show both approved and pending service types
  const serviceTypes = $derived([...approvedServiceTypes, ...pendingServiceTypes]);
  const pendingCount = $derived(pendingServiceTypes.length);
  
  // Filtered service types - start with empty and let the search component populate it
  let filteredServiceTypes = $state<UIServiceType[]>([]);

  // Initialize with all service types when they load
  $effect(() => {
    if (serviceTypes.length > 0 && filteredServiceTypes.length === 0) {
      filteredServiceTypes = [...serviceTypes];
    }
  });

  async function loadServiceTypes() {
    pageState.isLoading = true;
    pageState.error = null;

    try {
      // Load both approved and pending service types to ensure we see all created service types
      await Promise.all([
        runEffect(serviceTypesStore.getApprovedServiceTypes()),
        runEffect(serviceTypesStore.getPendingServiceTypes()).catch(error => {
          console.warn('Failed to load pending service types:', error);
          // Don't fail the whole operation if pending service types can't be loaded
        })
      ]);
    } catch (error) {
      console.error('Error loading service types:', error);
      pageState.error = error instanceof Error ? error.message : 'Failed to load service types';
      toastStore.trigger({
        message: 'Failed to load service types',
        background: 'variant-filled-error'
      });
    } finally {
      pageState.isLoading = false;
    }
  }

  function handleDeleteServiceType(serviceTypeHash: ActionHash) {
    const confirmEffect = E.gen(function* () {
      const confirmed = yield* E.promise<boolean>(() => 
        new Promise((resolve) => {
          modalStore.trigger({
            type: 'component',
            component: { ref: ConfirmModal },
            meta: {
              message: 'Are you sure you want to delete this service type?<br/>This action cannot be undone.',
              confirmLabel: 'Delete',
              cancelLabel: 'Cancel'
            } as ConfirmModalMeta,
            response: (confirmed: boolean) => resolve(confirmed)
          });
        })
      );

      if (!confirmed) {
        return;
      }

      yield* serviceTypesStore.deleteServiceType(serviceTypeHash);
      
      // Refresh the service types list to ensure UI is updated
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

  function handleCreateMockServiceTypes() {
    const createMockEffect = E.gen(function* () {
      const confirmed = yield* E.promise<boolean>(() => 
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

      if (!confirmed) {
        return;
      }

      pageState.isLoading = true;
      
      const mockServiceTypes = yield* E.promise(() => createMockedServiceTypes(5));

      // Create each mock service type
      for (const serviceType of mockServiceTypes) {
        yield* serviceTypesStore.createServiceType(serviceType);
      }

      // Refresh the service types list to show the newly created ones  
      yield* E.promise(() => loadServiceTypes());

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

    const finalEffect = E.ensuring(effectWithErrorHandling, E.sync(() => {
      pageState.isLoading = false;
    }));

    runEffect(finalEffect);
  }

  function handleFilteredResultsChange(filtered: UIServiceType[]) {
    filteredServiceTypes = filtered;
  }

  onMount(async () => {
    await loadServiceTypes();
    // Also load all tags for the autocomplete
    try {
      await runEffect(serviceTypesStore.loadAllTags());
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  });
  
  // Refresh data when the page becomes visible again (e.g., returning from create page)
  $effect(() => {
    function handleVisibilityChange() {
      if (!document.hidden) {
        // Page became visible, refresh data
        loadServiceTypes();
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="h1">Service Types Management</h1>
    <div class="flex gap-2">
      <a href="/admin/service-types/moderate" class="variant-filled-secondary btn">
        Moderate Suggestions
        {#if pendingCount > 0}
          <span class="badge-icon ml-2 bg-primary-500 text-white">{pendingCount}</span>
        {/if}
      </a>
      <a href="/admin/service-types/create" class="variant-filled-primary btn">
        Create Service Type
      </a>
      <button
        class="variant-filled-tertiary btn"
        onclick={handleCreateMockServiceTypes}
        disabled={pageState.isLoading}
      >
        {#if pageState.isLoading}
          Creating...
        {:else}
          Create Mock Service Types
        {/if}
      </button>
    </div>
  </div>

  <!-- Loading State -->
  {#if pageState.isLoading}
    <div class="flex items-center justify-center space-x-2 text-center">
      <span class="loading loading-spinner"></span>
      <span>Loading service types...</span>
    </div>

    <!-- Error State -->
  {:else if pageState.error || storeError}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{pageState.error || storeError}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={loadServiceTypes}> Try Again </button>
      </div>
    </div>
  {:else}
    <!-- Search and Filter Controls -->
    <div class="mb-6">
      <ServiceTypeSearch
        serviceTypes={serviceTypes}
        onFilteredResultsChange={handleFilteredResultsChange}
        searchOptions={{ tagCloudBehavior: 'toggle' }}
      />
    </div>

    <!-- Service Types List -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="h2">
          Approved Service Types ({filteredServiceTypes.length})
        </h2>

      </div>

      {#if filteredServiceTypes.length === 0}
        <div class="card p-8 text-center">
          <h3 class="h3">No Service Types Found</h3>
          <p class="text-surface-600">
            {#if filteredServiceTypes.length === 0 && serviceTypes.length > 0}
              No service types match your current filters.
            {:else}
              No service types have been created yet.
            {/if}
          </p>
          {#if serviceTypes.length === 0}
            <a href="/admin/service-types/create" class="variant-filled-primary btn mt-4">
              Create First Service Type
            </a>
          {/if}
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each filteredServiceTypes as serviceType (serviceType.original_action_hash?.toString())}
            <ServiceTypeCard
              {serviceType}
              onEdit={() => {
                // Navigate to edit page using proper hash encoding
                if (serviceType.original_action_hash) {
                  const encodedHash = encodeHashToBase64(serviceType.original_action_hash);
                  window.location.href = `/admin/service-types/${encodedHash}/edit`;
                }
              }}
              onDelete={() => {
                if (serviceType.original_action_hash) {
                  handleDeleteServiceType(serviceType.original_action_hash);
                }
              }}
              showActions={true}
            />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</section>
