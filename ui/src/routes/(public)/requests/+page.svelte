<script lang="ts">
  import { goto } from '$app/navigation';
  import { useRequestsManagement } from '$lib/composables';
  import RequestsTable from '$lib/components/requests/RequestsTable.svelte';
  import RequestFilterControls from '$lib/components/requests/RequestFilterControls.svelte';
  import ProfileGuard from '$lib/components/common/ProfileGuard.svelte';
  import usersStore from '$lib/stores/users.store.svelte';

  // Use the composable for all state management and operations
  const management = useRequestsManagement();

  // State for search-filtered results
  let searchFilteredRequests = $state<typeof management.filteredRequests>([]);

  // Handle create request action
  function handleCreateRequest() {
    goto('/requests/create');
  }

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
>
  <div class="container mx-auto p-4">
    <!-- Tab Switcher -->
    <div class="mb-4 flex items-center justify-between">
      <div class="flex gap-2">
        <button
          class="btn btn-sm"
          class:variant-filled-primary={management.listingTab === 'active'}
          class:variant-ghost-primary={management.listingTab !== 'active'}
          onclick={() => management.setListingTab('active')}
        >
          📋 Active Requests
        </button>
        <button
          class="btn btn-sm"
          class:variant-filled-warning={management.listingTab === 'archived'}
          class:variant-ghost-warning={management.listingTab !== 'archived'}
          onclick={() => management.setListingTab('archived')}
        >
          📦 Archived Requests
        </button>
      </div>
      <div>
        {#if usersStore.currentUser?.status?.status_type === 'accepted'}
          <button class="variant-filled-primary btn btn-sm" onclick={handleCreateRequest}>
            Create Request
          </button>
        {:else if usersStore.currentUser}
          <button class="variant-soft btn btn-sm" disabled>
            Create Request (Profile Approval Required)
          </button>
        {:else}
          <a href="/user/create" class="variant-filled-primary btn btn-sm">
            Create Profile to Make Requests
          </a>
        {/if}
      </div>
    </div>

    <!-- Filter Buttons -->
    <div class="mb-4 flex items-center gap-2">
      <button
        class="btn btn-sm"
        class:variant-filled-primary={management.filterType === 'all'}
        class:variant-ghost-primary={management.filterType !== 'all'}
        onclick={() => management.setFilterType('all')}
      >
        All
      </button>
      <button
        class="btn btn-sm"
        class:variant-filled-secondary={management.filterType === 'my'}
        class:variant-ghost-secondary={management.filterType !== 'my'}
        onclick={() => management.setFilterType('my')}
      >
        My
      </button>
      <button
        class="btn btn-sm"
        class:variant-filled-tertiary={management.filterType === 'organization'}
        class:variant-ghost-tertiary={management.filterType !== 'organization'}
        onclick={() => management.setFilterType('organization')}
      >
        Organization
      </button>
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
      <div class="text-center text-xl text-surface-500">
        {#if management.listingTab === 'active'}
          {#if management.filterType === 'all'}
            No active requests found. Create your first request!
          {:else if management.filterType === 'my'}
            You haven't created any active requests yet.
          {:else}
            No active organization requests found.
          {/if}
        {:else if management.filterType === 'all'}
          No archived requests found.
        {:else if management.filterType === 'my'}
          You don't have any archived requests.
        {:else}
          No archived organization requests found.
        {/if}
      </div>
    {:else}
      <RequestsTable requests={searchFilteredRequests} showCreator={true} showOrganization={true} />
    {/if}
  </div>
</ProfileGuard>
