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
  <div class="flex flex-col items-center gap-4">
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
    <div class="card p-4">
      <div class="flex items-center justify-between">
        <h3 class="h4">Search Results</h3>
        <div class="text-surface-600-300-token space-x-4 text-sm">
          <span>Total: {organizations.length}</span>
          <span>Filtered: {filteredOrganizations.length}</span>
        </div>
      </div>
      {#if filteredOrganizations.length !== organizations.length}
        <div class="mt-2">
          <div class="bg-surface-200-700-token h-2 rounded-container-token">
            <div
              class="h-2 bg-primary-500 transition-all duration-300 rounded-container-token"
              style="width: {(filteredOrganizations.length / organizations.length) * 100}%"
            ></div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
