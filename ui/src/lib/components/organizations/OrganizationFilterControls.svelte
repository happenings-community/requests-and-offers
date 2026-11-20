<script lang="ts">
  import { useOrganizationSearch, type OrganizationSearchOptions } from '$lib/composables';
  import type { UIOrganization } from '$lib/types/ui';

  type Props = {
    organizations: UIOrganization[];
    onFilteredResultsChange?: (filteredOrganizations: UIOrganization[]) => void;
    searchOptions?: OrganizationSearchOptions;
    showStatistics?: boolean;
  };

  const {
    organizations,
    onFilteredResultsChange,
    searchOptions = {},
    showStatistics = true
  }: Props = $props();

  // Use the search composable
  const search = useOrganizationSearch(searchOptions);

  // Filter organizations whenever search state OR organizations prop changes
  const filteredOrganizations = $derived.by(() => {
    const filtered = search.filterOrganizations(organizations);
    return filtered;
  });

  // Watch for changes to filteredOrganizations and call the callback
  $effect(() => {
    onFilteredResultsChange?.(filteredOrganizations);
  });
</script>

<div class="space-y-4">
  <!-- Basic Search -->
  <div class="flex flex-wrap items-center gap-4">
    <input
      type="search"
      bind:value={search.searchState.searchTerm}
      oninput={(e) => search.updateSearchTerm((e.target as HTMLInputElement).value)}
      placeholder="Search organizations by name, description, legal name, email, or location..."
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
  {#if showStatistics && (organizations.length > 0 || filteredOrganizations.length > 0)}
    <p class="text-sm text-surface-500 dark:text-surface-300" aria-live="polite">
      {filteredOrganizations.length === organizations.length
        ? `${organizations.length} in all`
        : `Showing ${filteredOrganizations.length} of ${organizations.length}`}
    </p>
  {/if}
</div>
