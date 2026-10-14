<script lang="ts">
  import { useRequestSearch, type RequestSearchOptions } from '$lib/composables';
  import type { UIRequest } from '$lib/types/ui';

  type Props = {
    requests: UIRequest[];
    onFilteredResultsChange?: (filteredRequests: UIRequest[]) => void;
    searchOptions?: RequestSearchOptions;
    showStatistics?: boolean;
  };

  const {
    requests,
    onFilteredResultsChange,
    searchOptions = {},
    showStatistics = true
  }: Props = $props();

  // Use the search composable
  const search = useRequestSearch(searchOptions);

  // Filter requests whenever search state OR requests prop changes
  const filteredRequests = $derived.by(() => {
    const filtered = search.filterRequests(requests);
    return filtered;
  });

  // Watch for changes to filteredRequests and call the callback
  $effect(() => {
    onFilteredResultsChange?.(filteredRequests);
  });
</script>

<div class="space-y-4">
  <!-- Basic Search -->
  <div class="flex flex-col items-center gap-4">
    <input
      type="search"
      bind:value={search.searchState.searchTerm}
      oninput={(e) => search.updateSearchTerm((e.target as HTMLInputElement).value)}
      placeholder="Search requests by title or description..."
      class="input max-w-md flex-1"
    />

    {#if search.hasActiveFilters}
      <button
        type="button"
        class="variant-soft-error btn"
        onclick={search.clearAllFilters}
        title="Clear search"
      >
        Clear Search
      </button>
    {/if}
  </div>

  <!-- Search Statistics -->
  {#if showStatistics && (requests.length > 0 || filteredRequests.length > 0)}
    <div class="card p-4">
      <div class="flex items-center justify-between">
        <h3 class="h4">Search Results</h3>
        <div class="text-surface-600-300-token space-x-4 text-sm">
          <span>Total: {requests.length}</span>
          <span>Filtered: {filteredRequests.length}</span>
        </div>
      </div>
      {#if filteredRequests.length !== requests.length}
        <div class="mt-2">
          <div class="bg-surface-200-700-token h-2 rounded-container-token">
            <div
              class="h-2 bg-primary-500 transition-all duration-300 rounded-container-token"
              style="width: {(filteredRequests.length / requests.length) * 100}%"
            ></div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
