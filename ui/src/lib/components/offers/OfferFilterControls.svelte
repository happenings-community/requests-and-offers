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
  <div class="flex flex-wrap items-center gap-4">
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
    <p class="text-sm text-surface-500 dark:text-surface-300" aria-live="polite">
      {filteredOffers.length === offers.length
        ? `${offers.length} in all`
        : `Showing ${filteredOffers.length} of ${offers.length}`}
    </p>
  {/if}
</div>
