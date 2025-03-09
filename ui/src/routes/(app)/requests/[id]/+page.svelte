<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { decodeHashFromBase64 } from '@holochain/client';
  import requestsStore from '@/stores/requests.store.svelte';
  import usersStore from '@/stores/users.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import RequestStatusBadge from '@/lib/components/RequestStatusBadge.svelte';
  import RequestSkillsTags from '@/lib/components/RequestSkillsTags.svelte';
  import { formatDate } from '@/utils';
  import type { UIRequest } from '@/types/ui';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let request: UIRequest | null = $state(null);

  // Toast store for notifications
  const toastStore = getToastStore();

  // Derived values
  const { currentUser } = $derived(usersStore);
  const requestId = $derived($page.params.id);

  // Check if user can edit/delete the request
  const canEdit = $derived(() => {
    if (!currentUser || !request) return false;

    // User can edit if they created the request
    if (request.creator && currentUser.original_action_hash) {
      return request.creator.toString() === currentUser.original_action_hash.toString();
    }

    // TODO: Add organization coordinator check

    return false;
  });

  // Format dates
  const createdAt = $derived.by(() =>
    request?.created_at ? formatDate(new Date(request.created_at)) : 'Unknown'
  );
  const updatedAt = $derived.by(() =>
    request?.updated_at ? formatDate(new Date(request.updated_at)) : 'N/A'
  );

  // Handle edit action
  function handleEdit() {
    goto(`/requests/${requestId}/edit`);
  }

  // Handle delete action
  async function handleDelete() {
    if (!request?.original_action_hash) return;

    if (!confirm('Are you sure you want to delete this request?')) return;

    try {
      // TODO: Implement delete functionality when available
      // await requestsStore.deleteRequest(request.original_action_hash);

      toastStore.trigger({
        message: 'Request deleted successfully!',
        background: 'variant-filled-success'
      });

      goto('/requests');
    } catch (err) {
      console.error('Failed to delete request:', err);
      toastStore.trigger({
        message: `Failed to delete request: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

  // Load request data on component mount
  $effect(() => {
    async function loadRequest() {
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
        const fetchedRequest = await requestsStore.getLatestRequest(requestHash);

        if (!fetchedRequest) {
          error = 'Request not found';
          return;
        }

        request = fetchedRequest;

        // If the request has an organization, fetch organization details
        if (request.organization) {
          await organizationsStore.getLatestOrganization(request.organization);
        }
      } catch (err) {
        console.error('Failed to load request:', err);
        error = err instanceof Error ? err.message : 'Failed to load request';
      } finally {
        isLoading = false;
      }
    }

    loadRequest();
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Request Details</h1>
    <button class="btn variant-soft" onclick={() => goto('/requests')}> Back to Requests </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading request details...</p>
    </div>
  {:else if request}
    <div class="card variant-soft p-6">
      <!-- Header with title and status -->
      <header
        class="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center"
      >
        <div>
          <h2 class="h2 font-semibold">{request.title}</h2>
        </div>
        <RequestStatusBadge state={request.process_state} showLabel={true} />
      </header>

      <!-- Main content -->
      <div class="space-y-6">
        <!-- Description -->
        <div>
          <h3 class="h4 mb-2 font-semibold">Description</h3>
          <p class="whitespace-pre-line">{request.description}</p>
        </div>

        <!-- Skills -->
        <div>
          <h3 class="h4 mb-2 font-semibold">Skills Required</h3>
          {#if request.skills.length > 0}
            <RequestSkillsTags skills={request.skills} maxVisible={10} />
          {:else}
            <p class="text-surface-500">No skills specified.</p>
          {/if}
        </div>

        <!-- Creator info -->
        <div>
          <h3 class="h4 mb-2 font-semibold">Creator</h3>
          <div class="flex items-center gap-2">
            <!-- TODO: Add creator avatar and details when available -->
            <span class="text-surface-500 italic">Creator information will be displayed here</span>
          </div>
        </div>

        <!-- Organization info (if applicable) -->
        {#if request.organization}
          <div>
            <h3 class="h4 mb-2 font-semibold">Organization</h3>
            <div class="flex items-center gap-2">
              <!-- TODO: Add organization logo and details when available -->
              <span class="text-surface-500 italic"
                >Organization information will be displayed here</span
              >
            </div>
          </div>
        {/if}

        <!-- Metadata -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h3 class="h4 mb-2 font-semibold">Created</h3>
            <p>{createdAt}</p>
          </div>
          <div>
            <h3 class="h4 mb-2 font-semibold">Last Updated</h3>
            <p>{updatedAt}</p>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      {#if canEdit()}
        <div class="mt-6 flex justify-end gap-2">
          <button class="btn variant-filled-secondary" onclick={handleEdit}> Edit </button>
          <button class="btn variant-filled-error" onclick={handleDelete}> Delete </button>
        </div>
      {/if}
    </div>
  {/if}
</section>
