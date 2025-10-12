<script lang="ts">
  import { useUserSearch, type UserSearchOptions } from '$lib/composables';
  import type { UIUser } from '$lib/types/ui';

  type Props = {
    users: UIUser[];
    onFilteredResultsChange?: (filteredUsers: UIUser[]) => void;
    searchOptions?: UserSearchOptions;
    showStatistics?: boolean;
  };

  const {
    users,
    onFilteredResultsChange,
    searchOptions = {},
    showStatistics = true
  }: Props = $props();

  // Use the search composable
  const search = useUserSearch(searchOptions);

  // Filter users whenever search state OR users prop changes
  const filteredUsers = $derived.by(() => {
    const filtered = search.filterUsers(users);
    // Call the callback immediately when the derived value changes
    return filtered;
  });

  // Watch for changes to filteredUsers and call the callback
  $effect(() => {
    onFilteredResultsChange?.(filteredUsers);
  });
</script>

<div class="space-y-4">
  <!-- Basic Search -->
  <div class="flex flex-col items-center gap-4">
    <input
      type="search"
      bind:value={search.searchState.searchTerm}
      oninput={(e) => search.updateSearchTerm((e.target as HTMLInputElement).value)}
      placeholder="Search by name or nickname..."
      class="input max-w-md flex-1"
    />

    <label class="flex items-center gap-2">
      <span class="w-full">User type:</span>
      <select
        bind:value={search.searchState.userTypeFilter}
        onchange={(e) =>
          search.updateUserTypeFilter(
            (e.target as HTMLSelectElement).value as 'all' | 'creator' | 'advocate'
          )}
        class="select max-w-xs"
      >
        <option value="all">All Users</option>
        <option value="creator">Creators</option>
        <option value="advocate">Advocates</option>
      </select>
    </label>

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
  {#if showStatistics && (users.length > 0 || filteredUsers.length > 0)}
    <div class="card p-4">
      <div class="flex items-center justify-between">
        <h3 class="h4">Search Results</h3>
        <div class="text-surface-600-300-token space-x-4 text-sm">
          <span>Total: {users.length}</span>
          <span>Filtered: {filteredUsers.length}</span>
        </div>
      </div>
      {#if filteredUsers.length !== users.length}
        <div class="mt-2">
          <div class="bg-surface-200-700-token h-2 rounded-container-token">
            <div
              class="h-2 bg-primary-500 transition-all duration-300 rounded-container-token"
              style="width: {(filteredUsers.length / users.length) * 100}%"
            ></div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
