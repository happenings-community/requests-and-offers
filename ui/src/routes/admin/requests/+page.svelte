<script lang="ts">
  import { onMount } from 'svelte';
  import RequestsTable from '$lib/components/requests/RequestsTable.svelte';
  import { useRequestsManagement } from '$lib/composables';

  // Use the composable for all state management and operations
  const management = useRequestsManagement();

  onMount(async () => {
    await management.initialize();
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Requests Management</h1>
    <button class="btn variant-filled-primary" onclick={() => management.loadRequests()}>
      Refresh
    </button>
  </div>

  {#if management.error || management.storeError}
    <div class="alert variant-filled-error mb-4">
      <p>{management.error || management.storeError}</p>
      <button
        class="btn btn-sm variant-soft"
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
  {:else if management.requests.length === 0}
    <div class="card variant-soft bg-surface-100-800-token/90 p-8 text-center backdrop-blur-lg">
      <span class="material-symbols-outlined text-surface-500 mb-4 text-6xl">inbox</span>
      <p class="text-surface-500 text-xl">
        {#if management.currentUser}
          No requests found in the system.
        {:else}
          Please log in to view requests.
        {/if}
      </p>
    </div>
  {:else}
    <div
      class="bg-surface-100-800-token/90 rounded-container-token p-4 backdrop-blur-lg"
    >
      <RequestsTable
        requests={management.requests}
        showOrganization={true}
        showCreator={true}
        title="All Requests"
      />
    </div>
  {/if}
</section>
