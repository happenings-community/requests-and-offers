<script lang="ts">
  import TagAutocomplete from '$lib/components/shared/TagAutocomplete.svelte';
  import TagCloud from '$lib/components/shared/TagCloud.svelte';
  import { useServiceTypeSearch, type ServiceTypeSearchOptions } from '$lib/composables/useServiceTypeSearch.svelte';
  import type { UIServiceType } from '$lib/types/ui';

  type Props = {
    serviceTypes: UIServiceType[];
    onFilteredResultsChange?: (filteredServiceTypes: UIServiceType[]) => void;
    searchOptions?: ServiceTypeSearchOptions;
    showStatistics?: boolean;
    tagCloudMaxTags?: number;
    tagCloudShowCounts?: boolean;
    customTagCloudDescription?: string;
  };

  const {
    serviceTypes,
    onFilteredResultsChange,
    searchOptions = {},
    showStatistics = true,
    tagCloudMaxTags = 15,
    tagCloudShowCounts = true,
    customTagCloudDescription
  }: Props = $props();

  // Use the search composable
  const search = useServiceTypeSearch(searchOptions);

  // Filter service types whenever search state changes
  const filteredServiceTypes = $derived(() => {
    const filtered = search.filterServiceTypes(serviceTypes);
    onFilteredResultsChange?.(filtered);
    return filtered;
  });

  // Get the tag cloud description based on behavior
  const tagCloudDescription = $derived.by(() => {
    if (customTagCloudDescription) return customTagCloudDescription;
    
    const behavior = searchOptions?.tagCloudBehavior || 'add-only';
    return behavior === 'toggle'
      ? 'Click on a tag to select/deselect it for filtering'
      : 'Click on a tag to filter service types';
  });
</script>

<div class="space-y-4">
  <!-- Basic Search -->
  <div class="flex items-center gap-4">
    <input
      type="search"
      bind:value={search.searchState.searchTerm}
      oninput={(e) => search.updateSearchTerm((e.target as HTMLInputElement).value)}
      placeholder="Search by name, description, or tag..."
      class="input max-w-md flex-1"
    />

    <button type="button" class="variant-ghost-surface btn" onclick={search.toggleAdvancedSearch}>
      <span class="text-sm">
        {search.searchState.showAdvancedSearch ? 'Hide' : 'Show'} Advanced Search
      </span>
      <span class="ml-1 text-xs">
        {search.searchState.showAdvancedSearch ? '▲' : '▼'}
      </span>
    </button>

    {#if search.hasActiveFilters}
      <button
        type="button"
        class="variant-soft-error btn"
        onclick={search.clearAllFilters}
        title="Clear all filters"
      >
        Clear All
      </button>
    {/if}
  </div>

  <!-- Advanced Search Panel -->
  {#if search.searchState.showAdvancedSearch}
    <div class="card space-y-4 p-4">
      <h3 class="h4">Advanced Search Options</h3>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- Tag Filter -->
        <div>
          <TagAutocomplete
            selectedTags={search.searchState.selectedFilterTags}
            onTagsChange={search.handleTagFilterChange}
            label="Filter by Tags"
            placeholder="Search tags to filter by..."
            allowCustomTags={false}
          />

          {#if search.searchState.selectedFilterTags.length > 0}
            <div class="mt-2 flex items-center gap-2">
              <span class="text-surface-600-300-token text-sm">Filter mode:</span>
              <label class="flex items-center gap-1">
                <input 
                  type="radio" 
                  bind:group={search.searchState.tagFilterMode} 
                  value="any" 
                  onchange={() => search.updateTagFilterMode('any')}
                  class="radio" 
                />
                <span class="text-sm">Any tag (OR)</span>
              </label>
              <label class="flex items-center gap-1">
                <input 
                  type="radio" 
                  bind:group={search.searchState.tagFilterMode} 
                  value="all" 
                  onchange={() => search.updateTagFilterMode('all')}
                  class="radio" 
                />
                <span class="text-sm">All tags (AND)</span>
              </label>
            </div>
          {/if}
        </div>

        <!-- Search Statistics -->
        {#if showStatistics}
          <div class="space-y-2">
            <h4 class="h5">Search Results</h4>
            <div class="text-surface-600-300-token space-y-1 text-sm">
              <p>Total service types: {serviceTypes.length}</p>
              <p>Filtered results: {filteredServiceTypes.length}</p>
              {#if search.searchState.selectedFilterTags.length > 0}
                <p>Active tag filters: {search.searchState.selectedFilterTags.length}</p>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Tag Cloud -->
  <div class="card p-4">
    <h3 class="h4 mb-3">Popular Tags</h3>
    <TagCloud 
      onTagClick={search.handleTagCloudClick} 
      maxTags={tagCloudMaxTags} 
      showCounts={tagCloudShowCounts} 
    />
    <p class="text-surface-600-300-token mt-2 text-sm">{tagCloudDescription}</p>
  </div>
</div> 