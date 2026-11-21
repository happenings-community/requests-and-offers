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
  <div class="flex flex-wrap items-center gap-4">
    <input
      type="search"
      bind:value={search.searchState.searchTerm}
      oninput={(e) => search.updateSearchTerm((e.target as HTMLInputElement).value)}
      placeholder="Search by name or description..."
      class="input max-w-md flex-1"
    />

    <select
      bind:value={search.searchState.technicalFilter}
      onchange={(e) =>
        search.updateTechnicalFilter(
          (e.target as HTMLSelectElement).value as 'all' | 'technical' | 'non-technical'
        )}
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
    <p class="text-sm text-surface-500 dark:text-surface-300" aria-live="polite">
      {filteredServiceTypes.length === serviceTypes.length
        ? `${serviceTypes.length} in all`
        : `Showing ${filteredServiceTypes.length} of ${serviceTypes.length}`}
    </p>
  {/if}
</div>
