<script lang="ts">
  import { onMount } from 'svelte';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIServiceType } from '$lib/types/ui';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';
  import TagAutocomplete from '$lib/components/shared/TagAutocomplete.svelte';
  import TagCloud from '$lib/components/shared/TagCloud.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { encodeHashToBase64 } from '@holochain/client';
  import { createMockedServiceTypes } from '$lib/utils/mocks';
  import { page } from '$app/state';

  const toastStore = getToastStore();

  let pageState = $state({
    isLoading: true,
    error: null as string | null,
    searchTerm: '',
    selectedFilterTags: [] as string[],
    tagFilterMode: 'any' as 'any' | 'all',
    showAdvancedSearch: false
  });

  // Reactive getters from store (avoiding loading state to prevent reactive loops)
  const { approvedServiceTypes, pendingServiceTypes, error: storeError } = $derived(serviceTypesStore);
  const serviceTypes = $derived(approvedServiceTypes);
  const pendingCount = $derived(pendingServiceTypes.length);
  
  // Filtered service types based on search and tags
  const filteredServiceTypes = $derived(
    serviceTypes.filter((serviceType) => {
      // Apply text search filter
      let matchesText = true;
      if (pageState.searchTerm) {
        const lowerSearchTerm = pageState.searchTerm.toLowerCase();
        matchesText =
          serviceType.name.toLowerCase().includes(lowerSearchTerm) ||
          serviceType.description.toLowerCase().includes(lowerSearchTerm) ||
          serviceType.tags.some((tag) => tag.toLowerCase().includes(lowerSearchTerm));
      }

      // Apply tag filter
      let matchesTags = true;
      if (pageState.selectedFilterTags.length > 0) {
        if (pageState.tagFilterMode === 'all') {
          // AND logic: service type must have ALL selected tags
          matchesTags = pageState.selectedFilterTags.every((filterTag) =>
            serviceType.tags.some((tag) => tag.toLowerCase() === filterTag.toLowerCase())
          );
        } else {
          // OR logic: service type must have ANY of the selected tags
          matchesTags = pageState.selectedFilterTags.some((filterTag) =>
            serviceType.tags.some((tag) => tag.toLowerCase() === filterTag.toLowerCase())
          );
        }
      }

      return matchesText && matchesTags;
    })
  );

  // Check for tag parameter in URL and auto-select it
  $effect(() => {
    if (!page.url) return;
    const tagParam = page.url.searchParams.get('tag');
    if (tagParam && !pageState.selectedFilterTags.includes(tagParam)) {
      pageState.selectedFilterTags = [tagParam];
      pageState.showAdvancedSearch = true; // Auto-expand advanced search
    }
  });

  async function loadServiceTypes() {
    pageState.isLoading = true;
    pageState.error = null;

    try {
      // Load approved service types first
      await runEffect(serviceTypesStore.getApprovedServiceTypes());
      
      console.log("approved service types loaded:", serviceTypes);
      // Try to load pending service types, but don't fail if it doesn't work
      try {
        await runEffect(serviceTypesStore.getPendingServiceTypes());
      } catch (pendingError) {
        console.warn('Failed to load pending service types:', pendingError);
        // Continue without failing the whole page
      }
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
    if (!confirm('This will create 5 mock service types for testing. Continue?')) {
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

  function handleTagFilterChange(tags: string[]) {
    pageState.selectedFilterTags = tags;
  }

  function clearAllFilters() {
    pageState.searchTerm = '';
    pageState.selectedFilterTags = [];
  }

  function toggleAdvancedSearch() {
    pageState.showAdvancedSearch = !pageState.showAdvancedSearch;
  }

  function handleTagCloudClick(tag: string) {
    // Add the clicked tag to the filter
    if (!pageState.selectedFilterTags.includes(tag)) {
      pageState.selectedFilterTags = [...pageState.selectedFilterTags, tag];
    }
    // Show advanced search if not already visible
    if (!pageState.showAdvancedSearch) {
      pageState.showAdvancedSearch = true;
    }
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
    <div class="space-y-4 mb-6">
      <!-- Basic Search -->
      <div class="flex items-center gap-4">
        <input
          type="search"
          bind:value={pageState.searchTerm}
          placeholder="Search by name, description, or tag..."
          class="input max-w-md flex-1"
        />
        
        <button type="button" class="variant-ghost-surface btn" onclick={toggleAdvancedSearch}>
          <span class="text-sm">
            {pageState.showAdvancedSearch ? 'Hide' : 'Show'} Advanced Search
          </span>
          <span class="ml-1 text-xs">
            {pageState.showAdvancedSearch ? '▲' : '▼'}
          </span>
        </button>

        {#if pageState.selectedFilterTags.length > 0 || pageState.searchTerm}
          <button
            type="button"
            class="variant-soft-error btn"
            onclick={clearAllFilters}
            title="Clear all filters"
          >
            Clear All
          </button>
        {/if}
      </div>

      <!-- Advanced Search Panel -->
      {#if pageState.showAdvancedSearch}
        <div class="card space-y-4 p-4">
          <h3 class="h4">Advanced Search Options</h3>
          
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <!-- Tag Filter -->
            <div>
              <TagAutocomplete
                selectedTags={pageState.selectedFilterTags}
                onTagsChange={handleTagFilterChange}
                label="Filter by Tags"
                placeholder="Search tags to filter by..."
                allowCustomTags={false}
              />
              
              {#if pageState.selectedFilterTags.length > 0}
                <div class="mt-2 flex items-center gap-2">
                  <span class="text-surface-600-300-token text-sm">Filter mode:</span>
                  <label class="flex items-center gap-1">
                    <input type="radio" bind:group={pageState.tagFilterMode} value="any" class="radio" />
                    <span class="text-sm">Any tag (OR)</span>
                  </label>
                  <label class="flex items-center gap-1">
                    <input type="radio" bind:group={pageState.tagFilterMode} value="all" class="radio" />
                    <span class="text-sm">All tags (AND)</span>
                  </label>
                </div>
              {/if}
            </div>

            <!-- Search Statistics -->
            <div class="space-y-2">
              <h4 class="h5">Search Results</h4>
              <div class="text-surface-600-300-token space-y-1 text-sm">
                <p>Total service types: {serviceTypes.length}</p>
                <p>Filtered results: {filteredServiceTypes.length}</p>
                {#if pageState.selectedFilterTags.length > 0}
                  <p>Active tag filters: {pageState.selectedFilterTags.length}</p>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Tag Cloud -->
      <div class="card p-4">
        <h3 class="h4 mb-3">Popular Tags</h3>
        <TagCloud onTagClick={handleTagCloudClick} maxTags={15} showCounts={true} />
        <p class="text-surface-600-300-token mt-2 text-sm">Click on a tag to filter service types</p>
      </div>
    </div>

    <!-- Service Types List -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="h2">
          Approved Service Types ({filteredServiceTypes.length})
        </h2>
        {#if pageState.searchTerm || pageState.selectedFilterTags.length > 0}
          <button
            class="variant-ghost-surface btn btn-sm"
            onclick={clearAllFilters}
          >
            Clear Filters
          </button>
        {/if}
      </div>

      {#if filteredServiceTypes.length === 0}
        <div class="card p-8 text-center">
          <h3 class="h3">No Service Types Found</h3>
          <p class="text-surface-600">
            {#if pageState.searchTerm || pageState.selectedFilterTags.length > 0}
              No service types match your current filters.
            {:else}
              No service types have been created yet.
            {/if}
          </p>
          {#if !pageState.searchTerm && pageState.selectedFilterTags.length === 0}
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
