<script lang="ts">
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import requestsStore from '@/stores/requests.store.svelte';
  import usersStore from '@/stores/users.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import RequestForm from '@/lib/components/RequestForm.svelte';
  import type { RequestInDHT } from '@/types/holochain';
  import type { ActionHash } from '@holochain/client';
  import { encodeHashToBase64 } from '@holochain/client';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);

  // Toast store for notifications
  const toastStore = getToastStore();

  // Derived values
  const { currentUser } = $derived(usersStore);
  const { acceptedOrganizations } = $derived(organizationsStore);

  // Handle form submission
  async function handleSubmit(request: RequestInDHT, organizationHash?: ActionHash) {
    try {
      const record = await requestsStore.createRequest(request, organizationHash);

      toastStore.trigger({
        message: 'Request created successfully!',
        background: 'variant-filled-success'
      });

      // Navigate to the requests list
      goto('/requests');
    } catch (err) {
      console.error('Failed to create request:', err);
      toastStore.trigger({
        message: `Failed to create request: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

  // Load user organizations on component mount
  $effect(() => {
    async function loadOrganizations() {
      try {
        isLoading = true;
        error = null;

        if (currentUser?.original_action_hash) {
          await organizationsStore.getUserOrganizations(currentUser.original_action_hash);
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
        error = err instanceof Error ? err.message : 'Failed to load organizations';
      } finally {
        isLoading = false;
      }
    }

    loadOrganizations();
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Create Request</h1>
    <button class="btn variant-soft" onclick={() => goto('/requests')}> Back to Requests </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
    </div>
  {/if}

  {#if !currentUser}
    <div class="text-surface-500 text-center text-xl">Please log in to create requests.</div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading...</p>
    </div>
  {:else}
    <div class="card variant-soft p-6">
      <RequestForm mode="create" organizations={acceptedOrganizations} onSubmit={handleSubmit} />
    </div>
  {/if}
</section>
