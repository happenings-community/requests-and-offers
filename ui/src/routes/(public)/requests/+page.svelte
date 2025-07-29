<script lang="ts">
  import { goto } from '$app/navigation';
  import { useRequestsManagement } from '$lib/composables';
  import RequestsTable from '$lib/components/requests/RequestsTable.svelte';
  import UserAccessGuard from '$lib/components/shared/UserAccessGuard.svelte';

  // Use the composable for all state management and operations
  const management = useRequestsManagement();

  // Handle create request action
  function handleCreateRequest() {
    goto('/requests/create');
  }

  // Initialize on mount
  $effect(() => {
    management.initialize();
  });
</script>

<svelte:head>
  <title>Requests | Happening Community</title>
</svelte:head>

<UserAccessGuard resourceType="requests">
  {#snippet children()}
    <div class="container mx-auto p-4">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="h1">Requests</h1>
        <button class="variant-filled-primary btn" onclick={handleCreateRequest}>
          Create Request
        </button>
      </div>

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
    </div>
  {/snippet}
</UserAccessGuard>
