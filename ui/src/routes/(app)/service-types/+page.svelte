<script lang="ts">
  import { onMount } from 'svelte';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';
  import TagAutocomplete from '$lib/components/shared/TagAutocomplete.svelte';
  import TagCloud from '$lib/components/shared/TagCloud.svelte';
  import { runEffect } from '$lib/utils/effect';
  import usersStore from '$lib/stores/users.store.svelte';
  import { page } from '$app/state';

  let pageState = $state({
    isLoading: true,
    error: null as string | null
  });

  const { currentUser } = $derived(usersStore);

  // Reactive getter for approved service types from the store
  const { approvedServiceTypes, allTags } = $derived(serviceTypesStore);

  let searchTerm = $state('');
  let selectedFilterTags = $state<string[]>([]);
  let tagFilterMode = $state<'any' | 'all'>('any');
  let showAdvancedSearch = $state(false);

  // Check for tag parameter in URL and auto-select it
  $effect(() => {
    const tagParam = page.url.searchParams.get('tag');
    if (tagParam && !selectedFilterTags.includes(tagParam)) {
      selectedFilterTags = [tagParam];
      showAdvancedSearch = true; // Auto-expand advanced search
    }
  });

  const filteredServiceTypes = $derived(
    approvedServiceTypes.filter((serviceType) => {
      // Apply text search filter
      let matchesText = true;
      if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        matchesText =
          serviceType.name.toLowerCase().includes(lowerSearchTerm) ||
          serviceType.description.toLowerCase().includes(lowerSearchTerm) ||
          (serviceType.tags &&
            serviceType.tags.some((tag) => tag.toLowerCase().includes(lowerSearchTerm)));
      }

      // Apply tag filter
      let matchesTags = true;
      if (selectedFilterTags.length > 0) {
        if (tagFilterMode === 'all') {
          // AND logic: service type must have ALL selected tags
          matchesTags = selectedFilterTags.every((filterTag) =>
            serviceType.tags.some((tag) => tag.toLowerCase() === filterTag.toLowerCase())
          );
        } else {
          // OR logic: service type must have ANY of the selected tags
          matchesTags = selectedFilterTags.some((filterTag) =>
            serviceType.tags.some((tag) => tag.toLowerCase() === filterTag.toLowerCase())
          );
        }
      }

      return matchesText && matchesTags;
    })
  );

  async function loadApprovedServiceTypes() {
    pageState.isLoading = true;
    pageState.error = null;

    try {
      await runEffect(serviceTypesStore.getApprovedServiceTypes());
      // Also load all tags for the autocomplete
      await runEffect(serviceTypesStore.loadAllTags());
    } catch (error) {
      pageState.error = error instanceof Error ? error.message : 'Failed to load service types';
    } finally {
      pageState.isLoading = false;
    }
  }

  function handleTagFilterChange(tags: string[]) {
    selectedFilterTags = tags;
  }

  function clearAllFilters() {
    searchTerm = '';
    selectedFilterTags = [];
  }

  function toggleAdvancedSearch() {
    showAdvancedSearch = !showAdvancedSearch;
  }

  function handleTagCloudClick(tag: string) {
    // Add the clicked tag to the filter
    if (!selectedFilterTags.includes(tag)) {
      selectedFilterTags = [...selectedFilterTags, tag];
    }
    // Show advanced search if not already visible
    if (!showAdvancedSearch) {
      showAdvancedSearch = true;
    }
  }

  onMount(loadApprovedServiceTypes);
</script>

<section class="container mx-auto space-y-6 p-4">
  <div class="flex items-center justify-between">
    <h1 class="h1">Available Service Types</h1>
    {#if currentUser?.status?.status_type === 'accepted'}
      <a href="/service-types/suggest" class="variant-filled-primary btn">
        Suggest a Service Type
      </a>
    {/if}
  </div>

  <!-- Search and Filter Section -->
  <div class="mb-6 space-y-4">
    <!-- Basic Search -->
    <div class="flex items-center gap-4">
      <input
        type="search"
        bind:value={searchTerm}
        placeholder="Search by name, description, or tag..."
        class="input max-w-md flex-1"
      />

      <button type="button" class="variant-ghost-surface btn" onclick={toggleAdvancedSearch}>
        <span class="text-sm">
          {showAdvancedSearch ? 'Hide' : 'Show'} Advanced Search
        </span>
        <span class="ml-1 text-xs">
          {showAdvancedSearch ? '▲' : '▼'}
        </span>
      </button>

      {#if selectedFilterTags.length > 0 || searchTerm}
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
    {#if showAdvancedSearch}
      <div class="card space-y-4 p-4">
        <h3 class="h4">Advanced Search Options</h3>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <!-- Tag Filter -->
          <div>
            <TagAutocomplete
              selectedTags={selectedFilterTags}
              onTagsChange={handleTagFilterChange}
              label="Filter by Tags"
              placeholder="Search tags to filter by..."
              allowCustomTags={false}
            />

            {#if selectedFilterTags.length > 0}
              <div class="mt-2 flex items-center gap-2">
                <span class="text-surface-600-300-token text-sm">Filter mode:</span>
                <label class="flex items-center gap-1">
                  <input type="radio" bind:group={tagFilterMode} value="any" class="radio" />
                  <span class="text-sm">Any tag (OR)</span>
                </label>
                <label class="flex items-center gap-1">
                  <input type="radio" bind:group={tagFilterMode} value="all" class="radio" />
                  <span class="text-sm">All tags (AND)</span>
                </label>
              </div>
            {/if}
          </div>

          <!-- Search Statistics -->
          <div class="space-y-2">
            <h4 class="h5">Search Results</h4>
            <div class="text-surface-600-300-token space-y-1 text-sm">
              <p>Total service types: {approvedServiceTypes.length}</p>
              <p>Filtered results: {filteredServiceTypes.length}</p>
              {#if selectedFilterTags.length > 0}
                <p>Active tag filters: {selectedFilterTags.length}</p>
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

  <!-- Loading State -->
  {#if pageState.isLoading}
    <div class="flex items-center justify-center space-x-2 text-center">
      <span class="loading loading-spinner"></span>
      <span>Loading available services...</span>
    </div>

    <!-- Error State -->
  {:else if pageState.error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{pageState.error}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={loadApprovedServiceTypes}> Try Again </button>
      </div>
    </div>

    <!-- Content -->
  {:else if filteredServiceTypes.length === 0 && approvedServiceTypes.length > 0 && searchTerm}
    <div class="card p-8 text-center">
      <h3 class="h3">No Service Types Found</h3>
      <p class="text-surface-600">
        No service types match your search for "{searchTerm}".
      </p>
    </div>
  {:else if approvedServiceTypes.length === 0}
    <div class="card p-8 text-center">
      <h3 class="h3">No Service Types Available</h3>
      <p class="text-surface-600">
        There are currently no approved service types. Please check back later.
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each filteredServiceTypes as serviceType (serviceType.original_action_hash?.toString())}
        <ServiceTypeCard {serviceType} showActions={false} />
      {/each}
    </div>
  {/if}
</section>
