<script lang="ts">
  // TagAutocomplete and TagCloud imports removed as tags functionality has been removed
  import { useServiceTypeSearch, type ServiceTypeSearchOptions } from '$lib/composables';
  import type { UIServiceType } from '$lib/types/ui';

  type Props = {
    serviceTypes: UIServiceType[];
    onFilteredResultsChange?: (filteredServiceTypes: UIServiceType[]) => void;
    searchOptions?: ServiceTypeSearchOptions;
    showStatistics?: boolean;
  };

  const {
    serviceTypes,
    onFilteredResultsChange,
    searchOptions = {},
    showStatistics = true
  }: Props = $props();

  // Use the search composable
  const search = useServiceTypeSearch(searchOptions);

  // Filter service types whenever search state OR serviceTypes prop changes
  const filteredServiceTypes = $derived.by(() => {
    const filtered = search.filterServiceTypes(serviceTypes);
    // Call the callback immediately when the derived value changes
    return filtered;
  });

  // Watch for changes to filteredServiceTypes and call the callback
  $effect(() => {
    onFilteredResultsChange?.(filteredServiceTypes);
  });

  // Tag cloud functionality removed as tags have been removed
</script>

<div class="space-y-4">
  <!-- Basic Search -->
  <div class="flex items-center gap-4">
    <input
      type="search"
      bind:value={search.searchState.searchTerm}
      oninput={(e) => search.updateSearchTerm((e.target as HTMLInputElement).value)}
      placeholder="Search by name or description..."
      class="input max-w-md flex-1"
    />

    <select
      bind:value={search.searchState.technicalFilter}
      onchange={(e) => search.updateTechnicalFilter((e.target as HTMLSelectElement).value as 'all' | 'technical' | 'non-technical')}
      class="select max-w-xs"
    >
      <option value="all">All Types</option>
      <option value="technical">Technical Only</option>
      <option value="non-technical">Non-Technical Only</option>
    </select>

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

  <!-- Search Statistics -->
  {#if showStatistics && (serviceTypes.length > 0 || filteredServiceTypes.length > 0)}
    <div class="card p-4">
      <div class="flex items-center justify-between">
        <h3 class="h4">Search Results</h3>
        <div class="text-surface-600-300-token space-x-4 text-sm">
          <span>Total: {serviceTypes.length}</span>
          <span>Filtered: {filteredServiceTypes.length}</span>
        </div>
      </div>
      {#if filteredServiceTypes.length !== serviceTypes.length}
        <div class="mt-2">
          <div class="bg-surface-200-700-token rounded-container-token h-2">
            <div
              class="bg-primary-500 h-2 rounded-container-token transition-all duration-300"
              style="width: {(filteredServiceTypes.length / serviceTypes.length) * 100}%"
            ></div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
