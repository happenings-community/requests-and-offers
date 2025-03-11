<script lang="ts">
  import usersStore from '@/stores/users.store.svelte';
  import requestsStore from '@/stores/requests.store.svelte';
  import RequestsTable from '@/lib/tables/RequestsTable.svelte';
  import type { UIRequest } from '@/types/ui';

  let isLoading = $state(true);
  let error: string | null = $state(null);
  let requests: UIRequest[] = $state([]);

  const { currentUser } = $derived(usersStore);

  async function fetchRequests() {
    try {
      isLoading = true;
      error = null;

      // Fetch all requests using the requestsStore
      requests = await requestsStore.getAllRequests();
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      error = err instanceof Error ? err.message : 'Failed to load requests';
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    fetchRequests();
  });
</script>

<section class="container mx-auto p-4">
  <div class="flex justify-between items-center mb-6">
    <h1 class="h1">Requests Management</h1>
    <button class="btn variant-filled-primary" onclick={() => fetchRequests()}>
      Refresh
    </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
      <button
        class="btn btn-sm variant-soft"
        onclick={() => {
          error = null;
          fetchRequests();
        }}
      >
        Retry
      </button>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading requests...</p>
    </div>
  {:else if requests.length === 0}
    <div class="card variant-soft p-8 text-center backdrop-blur-lg bg-surface-100-800-token/90">
      <span class="material-symbols-outlined text-6xl mb-4 text-surface-500">inbox</span>
      <p class="text-surface-500 text-xl">
        {#if currentUser}
          No requests found in the system.
        {:else}
          Please log in to view requests.
        {/if}
      </p>
    </div>
  {:else}
    <div class="backdrop-blur-lg bg-surface-100-800-token/90 p-4 rounded-container-token">
      <RequestsTable 
        requests={requests} 
        showOrganization={true} 
        showCreator={true} 
        title="All Requests"
      />
    </div>
  {/if}
</section>
