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
  <div class="flex flex-wrap items-center gap-4">
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
    <p class="text-sm text-surface-500 dark:text-surface-300" aria-live="polite">
      {filteredRequests.length === requests.length
        ? `${requests.length} in all`
        : `Showing ${filteredRequests.length} of ${requests.length}`}
    </p>
  {/if}
</div>
