<script lang="ts">
  import { useOfferSearch, type OfferSearchOptions } from '$lib/composables';
  import type { UIOffer } from '$lib/types/ui';

  type Props = {
    offers: UIOffer[];
    onFilteredResultsChange?: (filteredOffers: UIOffer[]) => void;
    searchOptions?: OfferSearchOptions;
    showStatistics?: boolean;
  };

  const {
    offers,
    onFilteredResultsChange,
    searchOptions = {},
    showStatistics = true
  }: Props = $props();

  // Use the search composable
  const search = useOfferSearch(searchOptions);

  // Filter offers whenever search state OR offers prop changes
  const filteredOffers = $derived.by(() => {
    const filtered = search.filterOffers(offers);
    return filtered;
  });

  // Watch for changes to filteredOffers and call the callback
  $effect(() => {
    onFilteredResultsChange?.(filteredOffers);
  });
</script>

<div class="space-y-4">
  <!-- Basic Search -->
  <div class="flex flex-col items-center gap-4">
    <input
      type="search"
      bind:value={search.searchState.searchTerm}
      oninput={(e) => search.updateSearchTerm((e.target as HTMLInputElement).value)}
      placeholder="Search offers by title or description..."
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
  {#if showStatistics && (offers.length > 0 || filteredOffers.length > 0)}
    <div class="card p-4">
      <div class="flex items-center justify-between">
        <h3 class="h4">Search Results</h3>
        <div class="text-surface-600-300-token space-x-4 text-sm">
          <span>Total: {offers.length}</span>
          <span>Filtered: {filteredOffers.length}</span>
        </div>
      </div>
      {#if filteredOffers.length !== offers.length}
        <div class="mt-2">
          <div class="bg-surface-200-700-token h-2 rounded-container-token">
            <div
              class="h-2 bg-primary-500 transition-all duration-300 rounded-container-token"
              style="width: {(filteredOffers.length / offers.length) * 100}%"
            ></div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
