<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import requestsStore from '@/stores/requests.store.svelte';
  import usersStore from '@/stores/users.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import RequestForm from '@/lib/components/RequestForm.svelte';
  import type { RequestInDHT } from '@/types/holochain';
  import type { ActionHash } from '@holochain/client';
  import type { UIRequest } from '@/types/ui';
  import { runEffect } from '@/utils/effect';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let request: UIRequest | null = $state(null);

  // Toast store for notifications
  const toastStore = getToastStore();

  // Derived values
  const { currentUser } = $derived(usersStore);
  const { acceptedOrganizations } = $derived(organizationsStore);
  const requestId = $derived(page.params.id);

  // Handle form submission
  async function handleSubmit(updatedRequest: RequestInDHT, organizationHash?: ActionHash) {
    if (!request?.original_action_hash || !request?.previous_action_hash) {
      toastStore.trigger({
        message: 'Cannot update request: missing action hashes',
        background: 'variant-filled-error'
      });
      return;
    }

    try {
      await runEffect(
        requestsStore.updateRequest(
          request.original_action_hash,
          request.previous_action_hash,
          updatedRequest
        )
      );

      toastStore.trigger({
        message: 'Request updated successfully!',
        background: 'variant-filled-success'
      });

      // Navigate back to the request details page
      goto(`/requests/${requestId}`);
    } catch (err) {
      console.error('Failed to update request:', err);
      toastStore.trigger({
        message: `Failed to update request: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

  // Load request data and user organizations on component mount
  $effect(() => {
    async function loadData() {
      try {
        isLoading = true;
        error = null;

        if (!requestId) {
          error = 'Invalid request ID';
          return;
        }

        // Decode the request hash from the URL
        const requestHash = decodeHashFromBase64(requestId);

        // Fetch the request
        const fetchedRequest = await runEffect(requestsStore.getLatestRequest(requestHash));

        if (!fetchedRequest) {
          error = 'Request not found';
          return;
        }

        request = fetchedRequest;

        // Load organizations
        if (currentUser?.original_action_hash) {
          await organizationsStore.getUserOrganizations(currentUser.original_action_hash);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        error = err instanceof Error ? err.message : 'Failed to load data';
      } finally {
        isLoading = false;
      }
    }

    loadData();
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Edit Request</h1>
    <button class="btn variant-soft" onclick={() => goto(`/requests/${requestId}`)}>
      Back to Request
    </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
    </div>
  {/if}

  {#if !currentUser}
    <div class="text-surface-500 text-center text-xl">Please log in to edit requests.</div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading...</p>
    </div>
  {:else if request}
    <div class="card variant-soft p-6">
      <RequestForm
        mode="edit"
        {request}
        organizations={acceptedOrganizations}
        onSubmit={handleSubmit}
      />
    </div>
  {:else}
    <div class="text-surface-500 text-center text-xl">Request not found.</div>
  {/if}
</section>
