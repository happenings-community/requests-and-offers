<script lang="ts">
  import { goto } from '$app/navigation';
  import requestsStore from '@/stores/requests.store.svelte';
  import usersStore from '@/stores/users.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import RequestsTable from '@/lib/tables/RequestsTable.svelte';
  import type { UIRequest } from '@/types/ui';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let filterType = $state<'all' | 'my' | 'organization'>('all');

  // Derived values
  const { currentUser } = $derived(usersStore);
  const { requests } = $derived(requestsStore);

  const filteredRequests = $derived.by(() => {
    if (!requests.length) return [];

    const filterFunctions = {
      my: (request: UIRequest) =>
        currentUser?.original_action_hash &&
        request.creator &&
        request.creator.toString() === currentUser.original_action_hash.toString(),

      organization: (request: UIRequest) =>
        currentUser?.organizations?.length! > 0 &&
        request.organization &&
        currentUser?.organizations?.some(
          (org) => org.toString() === request.organization?.toString()
        ),

      all: () => true
    };

    const filterFunction = filterFunctions[filterType] || filterFunctions.all;
    return requests.filter(filterFunction);
  });

  // Fetch all requests
  async function fetchRequests() {
    try {
      isLoading = true;
      error = null;
      await requestsStore.getAllRequests();
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      error = err instanceof Error ? err.message : 'Failed to load requests';
    } finally {
      isLoading = false;
    }
  }

  // Navigate to create request page
  function handleCreateRequest() {
    goto('/requests/create');
  }

  // Load data on component mount
  $effect(() => {
    fetchRequests();

    // Fetch organizations if user is logged in
    if (currentUser?.original_action_hash) {
      organizationsStore.getUserOrganizations(currentUser.original_action_hash);
    }
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex flex-col items-center justify-between md:flex-row">
    <h1 class="h1 text-center md:text-left">Requests</h1>

    {#if currentUser}
      <div class="mt-4 flex flex-col gap-4 sm:flex-row md:mt-0">
        <!-- Filter options -->
        <div class="flex gap-2">
          <button
            class="btn {filterType === 'all' ? 'variant-filled-primary' : 'variant-soft'}"
            onclick={() => (filterType = 'all')}
          >
            All
          </button>
          <button
            class="btn {filterType === 'my' ? 'variant-filled-primary' : 'variant-soft'}"
            onclick={() => (filterType = 'my')}
          >
            My Requests
          </button>
          {#if currentUser.organizations?.length}
            <button
              class="btn {filterType === 'organization'
                ? 'variant-filled-primary'
                : 'variant-soft'}"
              onclick={() => (filterType = 'organization')}
            >
              Organization
            </button>
          {/if}
        </div>

        <!-- Create button -->
        {#if currentUser.status?.status_type === 'accepted'}
          <button class="btn variant-filled-secondary" onclick={handleCreateRequest}>
            Create Request
          </button>
        {/if}
      </div>
    {/if}
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
  {:else if !currentUser}
    <div class="text-surface-500 text-center text-xl">
      Please log in to view and create requests.
    </div>
  {:else if filteredRequests.length === 0}
    <div class="text-surface-500 text-center text-xl">
      {#if filterType === 'all'}
        No requests found. Create your first request!
      {:else if filterType === 'my'}
        You haven't created any requests yet.
      {:else}
        No organization requests found.
      {/if}
    </div>
  {:else}
    <RequestsTable
      requests={filteredRequests as UIRequest[]}
      showOrganization={filterType !== 'organization'}
      showCreator={filterType !== 'my'}
    />
  {/if}
</section>
