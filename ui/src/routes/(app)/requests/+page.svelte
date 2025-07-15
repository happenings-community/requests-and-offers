<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import RequestsTable from '$lib/components/requests/RequestsTable.svelte';
  import { useRequestsManagement } from '$lib/composables';

  // Use the composable for all state management and operations
  const management = useRequestsManagement();

  onMount(async () => {
    await management.initialize();
  });

  function handleCreateRequest() {
    goto('/requests/create');
  }

  // Refresh data when the page becomes visible again (e.g., returning from create page)
  $effect(() => {
    function handleVisibilityChange() {
      if (!document.hidden) {
        management.loadRequests();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex flex-col items-center justify-between md:flex-row">
    <h1 class="h1 text-center md:text-left">Requests</h1>

    {#if management.currentUser}
      <div class="mt-4 flex flex-col gap-4 sm:flex-row md:mt-0">
        <!-- Filter options -->
        <div class="flex gap-2">
          <button
            class="btn {management.filterType === 'all'
              ? 'variant-filled-primary'
              : 'variant-soft'}"
            onclick={() => management.setFilterType('all')}
          >
            All
          </button>
          <button
            class="btn {management.filterType === 'my' ? 'variant-filled-primary' : 'variant-soft'}"
            onclick={() => management.setFilterType('my')}
          >
            My Requests
          </button>
          {#if management.currentUser.organizations?.length}
            <button
              class="btn {management.filterType === 'organization'
                ? 'variant-filled-primary'
                : 'variant-soft'}"
              onclick={() => management.setFilterType('organization')}
            >
              Organization
            </button>
          {/if}
        </div>

        <!-- Create button -->
        {#if management.canCreateRequests}
          <button class="variant-filled-secondary btn" onclick={handleCreateRequest}>
            Create Request
          </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if management.error || management.storeError}
    <div class="alert variant-filled-error mb-4">
      <p>{management.error || management.storeError}</p>
      <button
        class="variant-soft btn btn-sm"
        onclick={() => {
          management.loadRequests();
        }}
      >
        Retry
      </button>
    </div>
  {/if}

  {#if management.isLoading || management.storeLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading requests...</p>
    </div>
  {:else if !management.hasInitialized}
    <div class="flex h-64 items-center justify-center">
      <p class="text-surface-500">Loading...</p>
    </div>
  {:else if !management.currentUser}
    <div class="text-center text-xl text-surface-500">Please log in to view requests.</div>
  {:else if management.filteredRequests.length === 0}
    <div class="text-center text-xl text-surface-500">
      {#if management.filterType === 'all'}
        No requests found. Create your first request!
      {:else if management.filterType === 'my'}
        You haven't created any requests yet.
      {:else}
        No organization requests found.
      {/if}
    </div>
  {:else}
    <RequestsTable
      requests={management.filteredRequests}
      showCreator={true}
      showOrganization={true}
    />
  {/if}
</section>
