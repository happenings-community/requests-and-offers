<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import {
    getToastStore,
    getModalStore,
    type ModalSettings,
    type ModalComponent,

    Avatar

  } from '@skeletonlabs/skeleton';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import requestsStore from '@/stores/requests.store.svelte';
  import usersStore from '@/stores/users.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import { formatDate, getUserPictureUrl, getOrganizationLogoUrl } from '@/utils';
  import type { UIRequest, UIOrganization, UIUser } from '@/types/ui';
  import type { ConfirmModalMeta } from '@/lib/types';
  import ConfirmModal from '@/lib/dialogs/ConfirmModal.svelte';
  import RequestRequirementsTags from '@/lib/components/RequestRequirementsTags.svelte';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let request: UIRequest | null = $state(null);
  let creator: UIUser | null = $state(null);
  let organization: UIOrganization | null = $state(null);

  // Toast and modal stores for notifications
  const toastStore = getToastStore();
  const modalStore = getModalStore();

  // Register the ConfirmModal component
  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  // Derived values
  const { currentUser } = $derived(usersStore);
  const requestId = $derived(page.params.id);
  const creatorPictureUrl = $derived.by(() => (creator ? getUserPictureUrl(creator) : null));
  const organizationLogoUrl = $derived.by(() =>
    organization ? getOrganizationLogoUrl(organization) : null
  );

  // Check if user can edit/delete the request
  const canEdit = $derived.by(() => {
    if (!currentUser || !request) return false;

    // User can edit if they created the request
    if (request.creator && currentUser.original_action_hash) {
      return request.creator.toString() === currentUser.original_action_hash.toString();
    }

    // User can edit if they are an organization coordinator
    if (request.organization && organization?.coordinators) {
      return organization.coordinators.some(
        (coord) => coord.toString() === currentUser.original_action_hash?.toString()
      );
    }

    return false;
  });

  // Format dates
  const createdAt = $derived.by(() => {
    if (!request?.created_at) return 'Unknown';
    try {
      return formatDate(new Date(Number(request.created_at)));
    } catch (err) {
      console.error('Error formatting created date:', err);
      return 'Invalid date';
    }
  });

  const updatedAt = $derived.by(() => {
    if (!request?.updated_at) return 'N/A';
    try {
      return formatDate(new Date(Number(request.updated_at)));
    } catch (err) {
      console.error('Error formatting updated date:', err);
      return 'Invalid date';
    }
  });

  // Handle edit action
  function handleEdit() {
    goto(`/requests/${requestId}/edit`);
  }

  // Handle delete action
  async function handleDelete() {
    if (!request?.original_action_hash) return;

    // Create modal settings
    const modalSettings: ModalSettings = {
      type: 'component',
      component: confirmModalComponent,
      meta: {
        message: 'Are you sure you want to delete this request?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel'
      } as ConfirmModalMeta,
      response: (confirmed: boolean) => {
        if (confirmed) {
          deleteRequest();
        }
      }
    };

    // Open the modal
    modalStore.trigger(modalSettings);
  }

  // Function to actually delete the request
  async function deleteRequest() {
    if (!request?.original_action_hash) return;

    try {
      // Implement delete functionality
      if (requestsStore.deleteRequest) {
        await requestsStore.deleteRequest(request.original_action_hash);
      } else {
        throw new Error('Delete functionality is not available');
      }

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

  // Clean up blob URLs when component is destroyed
  $effect(() => {
    return () => {
      if (creatorPictureUrl && creatorPictureUrl !== '/default_avatar.webp') {
        URL.revokeObjectURL(creatorPictureUrl);
      }
      if (organizationLogoUrl && organizationLogoUrl !== '/default_avatar.webp') {
        URL.revokeObjectURL(organizationLogoUrl);
      }
    };
  });

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

        // If the request has a creator, fetch creator details
        if (request.creator) {
          creator = await usersStore.getUserByActionHash(request.creator);
        }

        // If the request has an organization, fetch organization details
        if (request.organization) {
          organization = await organizationsStore.getOrganizationByActionHash(request.organization);
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
    <button class="variant-soft btn" onclick={() => goto('/requests')}> Back to Requests </button>
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
    <div class="bg-surface-100-800-token/90 card variant-soft p-6 backdrop-blur-lg">
      <!-- Header with title and status -->
      <header class="mb-4 flex items-center gap-4">
        <div class="flex-grow">
          <h1 class="h2 font-bold">{request.title}</h1>
          <p class="text-surface-600-300-token mt-2">{request.description}</p>
        </div>
      </header>

      <!-- Main content -->
      <div class="space-y-6">
        <!-- Description -->
        <div>
          <h3 class="h4 mb-2 font-semibold">Description</h3>
          <p class="whitespace-pre-line">{request.description}</p>
        </div>

        <!-- Requirements (formerly Skills) -->
        <div>
          <h3 class="h4 mb-2 font-semibold">Requirements</h3>
          {#if request.requirements && request.requirements.length > 0}
            <RequestRequirementsTags requirements={request.requirements} maxVisible={10} />
          {:else}
            <p class="text-surface-500">No requirements specified.</p>
          {/if}
        </div>

        <!-- Urgency/Timeframe -->
        {#if request.urgency}
          <div>
            <h3 class="h4 mb-2 font-semibold">Urgency/Timeframe</h3>
            <p>{request.urgency}</p>
          </div>
        {/if}

        <!-- Organization info (if applicable) -->
        {#if request.organization}
          <div>
            <h3 class="h4 mb-2 font-semibold">Organization</h3>
            <div class="flex items-center gap-2">
              {#if organization}
                <a href={`/organizations/${encodeHashToBase64(request.organization)}`} class="flex items-center gap-3 hover:text-primary-500">
                  <Avatar
                    src={organizationLogoUrl!}
                    width="w-12"
                    rounded="rounded-full"
                  />
                  <div>
                    <p class="font-semibold">{organization.name}</p>
                    {#if organization.description}
                      <p class="text-surface-600-300-token text-sm">
                        {organization.description.substring(0, 50)}...
                      </p>
                    {/if}
                  </div>
                </a>
              {/if}
            </div>

            <!-- Organization Coordinators -->
            {#if organization?.coordinators && organization.coordinators.length > 0}
              <div class="border-surface-300-600-token mt-4 border-t pt-4">
                <h4 class="h5 mb-2 font-semibold">Exchange Coordinators</h4>
                <div class="flex flex-wrap gap-2">
                  {#each organization.coordinators as coordinator}
                    <a
                      href={`/users/${encodeHashToBase64(coordinator)}`}
                      class="variant-soft-secondary chip hover:variant-soft-primary"
                    >
                      View Coordinator
                    </a>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <!-- Creator info (only show if not an organization request) -->
          <div>
            <h3 class="h4 mb-2 font-semibold">Creator</h3>
            <div class="flex items-center gap-2">
              {#if creator}
                <a href={`/users/${encodeHashToBase64(request.creator!)}`} class="flex items-center gap-3 hover:text-primary-500">
                  <Avatar
                    src={getUserPictureUrl(creator)}
                    width="w-12"
                    rounded="rounded-full"
                  />
                  <div>
                    <p class="font-semibold">{creator.name}</p>
                    {#if creator.nickname}
                      <p class="text-surface-600-300-token text-sm">@{creator.nickname}</p>
                    {/if}
                  </div>
                </a>
              {:else}
                <span class="italic text-surface-500">Unknown creator</span>
              {/if}
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
      {#if canEdit}
        <div class="mt-6 flex justify-end gap-2">
          <button class="variant-filled-secondary btn" onclick={handleEdit}> Edit </button>
          <button class="variant-filled-error btn" onclick={handleDelete}> Delete </button>
        </div>
      {/if}
    </div>
  {/if}
</section>
