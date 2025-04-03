<script lang="ts">
  import usersStore from '@stores/users.store.svelte';
  import requestsStore from '@stores/requests.store.svelte';
  import RequestsTable from '@components/RequestsTable.svelte';
  import type { UIRequest } from '@types/ui';
  import { runEffect } from '@utils/effect';

  let isLoading = $state(true);
  let error: string | null = $state(null);
  let requests: UIRequest[] = $state([]);

  const { currentUser } = $derived(usersStore);

  async function loadRequests() {
    try {
      isLoading = true;
      // Fetch all requests using the requestsStore
      requests = await runEffect(requestsStore.getAllRequests());
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      error = err instanceof Error ? err.message : 'Failed to fetch requests';
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    loadRequests();
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Requests Management</h1>
    <button class="btn variant-filled-primary" onclick={() => loadRequests()}> Refresh </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
      <button
        class="btn btn-sm variant-soft"
        onclick={() => {
          error = null;
          loadRequests();
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
    <div class="card variant-soft bg-surface-100-800-token/90 p-8 text-center backdrop-blur-lg">
      <span class="material-symbols-outlined text-surface-500 mb-4 text-6xl">inbox</span>
      <p class="text-surface-500 text-xl">
        {#if currentUser}
          No requests found in the system.
        {:else}
          Please log in to view requests.
        {/if}
      </p>
    </div>
  {:else}
    <div class="bg-surface-100-800-token/90 rounded-container-token p-4 backdrop-blur-lg">
      <RequestsTable {requests} showOrganization={true} showCreator={true} title="All Requests" />
    </div>
  {/if}
</section>
