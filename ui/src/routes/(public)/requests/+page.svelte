<script lang="ts">
  import PageHeader from '$lib/components/shared/PageHeader.svelte';
  import { useRequestsManagement } from '$lib/composables';
  import RequestsTable from '$lib/components/requests/RequestsTable.svelte';
  import RequestFilterControls from '$lib/components/requests/RequestFilterControls.svelte';
  import ProfileGuard from '$lib/components/common/ProfileGuard.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { paths } from '$lib/paths';

  // Use the composable for all state management and operations
  const management = useRequestsManagement();

  // State for search-filtered results
  let searchFilteredRequests = $state<typeof management.filteredRequests>([]);

  const emptyStateMessage = $derived.by(() => {
    const messages = {
      active: {
        all: 'No active requests yet.',
        my: "You haven't created any active requests yet.",
        organization: 'No active organization requests found.'
      },
      archived: {
        all: 'No archived requests found.',
        my: "You don't have any archived requests.",
        organization: 'No archived organization requests found.'
      }
    };
    return messages[management.listingTab][management.filterType];
  });

  // Handle filtered results change from search component
  function handleFilteredResultsChange(filtered: typeof management.filteredRequests) {
    searchFilteredRequests = filtered;
  }

  // Initialize on mount
  $effect(() => {
    management.initialize();
  });
</script>

<svelte:head>
  <title>Requests | Happening Community</title>
</svelte:head>

<!-- SIMPLE WORKING VERSION -->
<ProfileGuard
  allowBrowsing={true}
  allowCreating={false}
  title="Profile Required for Creating Requests"
  description="Create a profile to make requests to the community."
  blockedAction="view or create requests"
>
  <div class="container mx-auto space-y-6 p-4">
    <PageHeader title="Requests" subtitle="What members are asking for">
      {#snippet actions()}
        {#if usersStore.currentUser?.status?.status_type === 'accepted'}
          <a href={paths.requestCreate()} class="variant-filled-secondary btn btn-sm">+ Request</a>
        {:else if usersStore.currentUser}
          <button class="variant-filled-secondary btn btn-sm" disabled>+ Request</button>
          <span class="text-sm text-surface-500">Once your profile is approved</span>
        {:else}
          <a href={paths.myProfileCreate()} class="variant-filled-primary btn btn-sm">
            Create a profile to post requests
          </a>
        {/if}
      {/snippet}
    </PageHeader>

    <!-- Which requests, and whose: toggle buttons in My Exchanges' style, violet when chosen -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap gap-2" role="group" aria-label="Active or archived requests">
        {#each [['active', 'Active Requests'], ['archived', 'Archived Requests']] as const as [tab, label] (tab)}
          <button
            class="btn btn-sm {management.listingTab === tab
              ? 'variant-filled-primary'
              : 'variant-ghost'}"
            aria-pressed={management.listingTab === tab}
            onclick={() => management.setListingTab(tab)}
          >
            {label}
          </button>
        {/each}
      </div>
      <div class="flex flex-wrap gap-2" role="group" aria-label="Whose requests">
        {#each [['all', 'All'], ['my', 'My'], ['organization', 'Organization']] as const as [filter, label] (filter)}
          <button
            class="btn btn-sm {management.filterType === filter
              ? 'variant-filled-primary'
              : 'variant-ghost'}"
            aria-pressed={management.filterType === filter}
            onclick={() => management.setFilterType(filter)}
          >
            {label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Search Controls -->
    <RequestFilterControls
      requests={management.filteredRequests}
      onFilteredResultsChange={handleFilteredResultsChange}
    />

    {#if management.isLoading || management.storeLoading}
      <div class="flex h-64 items-center justify-center">
        <div class="flex items-center gap-4">
          <span class="animate-spin text-2xl">⏳</span>
          <p class="text-lg">Loading requests...</p>
        </div>
      </div>
    {:else if !management.hasInitialized}
      <div class="flex h-64 items-center justify-center">
        <p class="text-surface-500">Initializing...</p>
      </div>
    {:else if searchFilteredRequests.length === 0}
      {#key `${management.listingTab}-${management.filterType}`}
        <div class="card space-y-3 p-6 text-center">
          <!-- A search that matches none of a list that has some: say so, with nothing to create. -->
          {#if management.filteredRequests.length > 0}
            <p class="text-surface-500">No requests match your search.</p>
          {:else}
            <p class="text-surface-500">{emptyStateMessage}</p>
          {/if}
          {#if management.filteredRequests.length === 0 && management.listingTab === 'active' && management.filterType !== 'organization' && usersStore.currentUser?.status?.status_type === 'accepted'}
            <a href={paths.requestCreate()} class="variant-filled-secondary btn">Create a request</a
            >
          {/if}
        </div>
      {/key}
    {:else}
      <RequestsTable requests={searchFilteredRequests} showCreator={true} showOrganization={true} />
    {/if}
  </div>
</ProfileGuard>
