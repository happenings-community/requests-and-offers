<script lang="ts">
  import { onMount } from 'svelte';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIServiceType } from '$lib/types/ui';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { encodeHashToBase64 } from '@holochain/client';
  import { createMockedServiceTypes } from '$lib/utils/mocks';

  const toastStore = getToastStore();

  let pageState = $state({
    isLoading: true,
    error: null as string | null,
    searchTerm: '',
    selectedCategory: 'all'
  });

  // Reactive getters from store
  const serviceTypes = $derived(serviceTypesStore.approvedServiceTypes); // Show only approved service types
  const pendingCount = $derived(serviceTypesStore.pendingServiceTypes.length); // Count of pending suggestions
  const storeLoading = $derived(serviceTypesStore.loading);
  const storeError = $derived(serviceTypesStore.error);

  // Filtered service types based on search and category
  const filteredServiceTypes = $derived(
    serviceTypes.filter((serviceType) => {
      const matchesSearch =
        serviceType.name.toLowerCase().includes(pageState.searchTerm.toLowerCase()) ||
        serviceType.description.toLowerCase().includes(pageState.searchTerm.toLowerCase()) ||
        serviceType.tags.some((tag) =>
          tag.toLowerCase().includes(pageState.searchTerm.toLowerCase())
        );

      const matchesCategory =
        pageState.selectedCategory === 'all' ||
        serviceType.tags.includes(pageState.selectedCategory);

      return matchesSearch && matchesCategory;
    })
  );

  // Get unique categories from all service types
  const categories = $derived(['all', ...new Set(serviceTypes.flatMap((st) => st.tags))]);

  async function loadServiceTypes() {
    pageState.isLoading = true;
    pageState.error = null;

    try {
      // Load both approved service types and pending count
      await Promise.all([
        runEffect(serviceTypesStore.getApprovedServiceTypes()),
        runEffect(serviceTypesStore.getPendingServiceTypes())
      ]);
    } catch (error) {
      pageState.error = error instanceof Error ? error.message : 'Failed to load service types';
      toastStore.trigger({
        message: 'Failed to load service types. Please try again.',
        background: 'variant-filled-error'
      });
    } finally {
      pageState.isLoading = false;
    }
  }

  async function handleDeleteServiceType(serviceTypeHash: ActionHash) {
    if (
      !confirm('Are you sure you want to delete this service type? This action cannot be undone.')
    ) {
      return;
    }

    try {
      await runEffect(serviceTypesStore.deleteServiceType(serviceTypeHash));
      toastStore.trigger({
        message: 'Service type deleted successfully',
        background: 'variant-filled-success'
      });
    } catch (error) {
      toastStore.trigger({
        message: `Failed to delete service type: ${error}`,
        background: 'variant-filled-error'
      });
    }
  }

  async function handleCreateMockServiceTypes() {
    if (
      !confirm('This will create 5 mock service types for testing. Continue?')
    ) {
      return;
    }

    try {
      pageState.isLoading = true;
      const mockServiceTypes = await createMockedServiceTypes(5);
      
      // Create each mock service type
      for (const serviceType of mockServiceTypes) {
        await runEffect(serviceTypesStore.createServiceType(serviceType));
      }

      toastStore.trigger({
        message: `${mockServiceTypes.length} mock service types created successfully`,
        background: 'variant-filled-success'
      });
    } catch (error) {
      toastStore.trigger({
        message: `Failed to create mock service types: ${error}`,
        background: 'variant-filled-error'
      });
    } finally {
      pageState.isLoading = false;
    }
  }

  onMount(loadServiceTypes);
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="h1">Service Types Management</h1>
    <div class="flex gap-2">
      <a href="/admin/service-types/moderate" class="btn variant-filled-secondary">
        Moderate Suggestions
        {#if pendingCount > 0}
          <span class="badge-icon bg-primary-500 text-white ml-2">{pendingCount}</span>
        {/if}
      </a>
      <a href="/admin/service-types/create" class="btn variant-filled-primary">
        Create Service Type
      </a>
      <button 
        class="btn variant-filled-tertiary" 
        onclick={handleCreateMockServiceTypes}
        disabled={pageState.isLoading || storeLoading}
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
  {#if pageState.isLoading || storeLoading}
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
    <div class="card p-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <!-- Search -->
        <label class="label">
          <span>Search Service Types</span>
          <input
            type="text"
            class="input"
            placeholder="Search by name, description, or tags..."
            bind:value={pageState.searchTerm}
          />
        </label>

        <!-- Category Filter -->
        <label class="label">
          <span>Filter by Category</span>
          <select class="select" bind:value={pageState.selectedCategory}>
            {#each categories as category}
              <option value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            {/each}
          </select>
        </label>
      </div>
    </div>

    <!-- Service Types List -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="h2">
          Approved Service Types ({filteredServiceTypes.length})
        </h2>
        {#if pageState.searchTerm || pageState.selectedCategory !== 'all'}
          <button
            class="btn btn-sm variant-ghost-surface"
            onclick={() => {
              pageState.searchTerm = '';
              pageState.selectedCategory = 'all';
            }}
          >
            Clear Filters
          </button>
        {/if}
      </div>

      {#if filteredServiceTypes.length === 0}
        <div class="card p-8 text-center">
          <h3 class="h3">No Service Types Found</h3>
          <p class="text-surface-600">
            {#if pageState.searchTerm || pageState.selectedCategory !== 'all'}
              No service types match your current filters.
            {:else}
              No service types have been created yet.
            {/if}
          </p>
          {#if !pageState.searchTerm && pageState.selectedCategory === 'all'}
            <a href="/admin/service-types/create" class="btn variant-filled-primary mt-4">
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
