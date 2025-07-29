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
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import requestsStore from '@/lib/stores/requests.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import { formatDate, getUserPictureUrl, getOrganizationLogoUrl } from '$lib/utils';
  import type { UIRequest, UIOrganization, UIUser, ConfirmModalMeta } from '$lib/types/ui';
  import {
    ContactPreferenceHelpers,
    TimePreferenceHelpers,
    InteractionType
  } from '$lib/types/holochain';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import MediumOfExchangeTag from '$lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { Effect as E, pipe } from 'effect';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let request: UIRequest | null = $state(null);
  let creator: UIUser | null = $state(null);
  let organization: UIOrganization | null = $state(null);
  let serviceTypeHashes: ActionHash[] = $state([]);

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
        message: 'Are you sure you want to delete this request?<br/>This action cannot be undone.',
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
      await runEffect(requestsStore.deleteRequest(request.original_action_hash));

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
    if (!requestId) {
      error = 'Invalid request ID';
      isLoading = false;
      return;
    }

    // Create a function to load the request data using proper Effect patterns
    const loadRequestData = async () => {
      isLoading = true;
      error = null;

      try {
        // Decode the request hash from the URL
        const requestHash = decodeHashFromBase64(requestId);

        // Use Effect TS pattern to fetch the request
        await runEffect(
          pipe(
            requestsStore.getLatestRequest(requestHash),
            E.map((fetchedRequest) => {
              if (!fetchedRequest) {
                error = 'Request not found';
                return;
              }

              request = fetchedRequest;
              return fetchedRequest;
            }),
            E.flatMap((fetchedRequest) => {
              if (!fetchedRequest) return E.succeed(null);

              if (fetchedRequest.creator) {
                runEffect(usersStore.getUserByActionHash(fetchedRequest.creator))
                  .then((user) => (creator = user))
                  .catch((err) => console.error(`Failed to load creator: ${err}`));
              }

              if (fetchedRequest.organization) {
                runEffect(
                  organizationsStore.getOrganizationByActionHash(fetchedRequest.organization)
                )
                  .then((org) => (organization = org))
                  .catch((err) => console.error(`Failed to load organization: ${err}`));
              }

              if (fetchedRequest.service_type_hashes) {
                serviceTypeHashes = fetchedRequest.service_type_hashes;
              }

              return E.succeed(null);
            })
          )
        );
      } catch (err) {
        console.error('Failed to load request:', err);
        error = err instanceof Error ? err.message : 'Failed to load request';
      } finally {
        isLoading = false;
      }
    };

    // Use setTimeout to prevent UI freezing during initial render
    setTimeout(() => {
      loadRequestData();
    }, 0);
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Request Details</h1>
    <button class="variant-soft btn" onclick={() => goto('/requests')}>Back to Requests</button>
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={() => location.reload()}>Try Again</button>
        <button class="btn btn-sm" onclick={() => goto('/requests')}>Back to Requests</button>
      </div>
    </div>
  {:else if isLoading}
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

        <!-- Service Types -->
        <div>
          <h3 class="h4 mb-2 font-semibold">Service Types</h3>
          {#if serviceTypeHashes && serviceTypeHashes.length > 0}
            <ul class="flex flex-wrap gap-2">
              {#each serviceTypeHashes as serviceTypeHash}
                <li>
                  <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} />
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-surface-500">No service types found.</p>
          {/if}
        </div>

        <!-- Medium of Exchange -->
        <div>
          <h3 class="h4 mb-2 font-semibold">Mediums of Exchange</h3>
          {#if request.medium_of_exchange_hashes && request.medium_of_exchange_hashes.length > 0}
            <ul class="flex flex-wrap gap-2">
              {#each request.medium_of_exchange_hashes as mediumHash}
                <li>
                  <MediumOfExchangeTag mediumOfExchangeActionHash={mediumHash} />
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-surface-500">No medium of exchange specified.</p>
          {/if}
        </div>

        <!-- Date Range and Time -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          {#if request.date_range}
            <div>
              <h3 class="h4 mb-2 font-semibold">Date Range</h3>
              <p>
                {#if request.date_range.start && request.date_range.end}
                  {formatDate(new Date(request.date_range.start))} to {formatDate(
                    new Date(request.date_range.end)
                  )}
                {:else if request.date_range.start}
                  Starting {formatDate(new Date(request.date_range.start))}
                {:else if request.date_range.end}
                  Until {formatDate(new Date(request.date_range.end))}
                {:else}
                  No date range specified
                {/if}
              </p>
            </div>
          {/if}

          {#if request.time_estimate_hours !== undefined}
            <div>
              <h3 class="h4 mb-2 font-semibold">Time Estimate</h3>
              <p>{request.time_estimate_hours} hours</p>
            </div>
          {/if}
        </div>

        <!-- Preferences -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          {#if request.time_preference}
            <div>
              <h3 class="h4 mb-2 font-semibold">Time Preference</h3>
              <p>{TimePreferenceHelpers.getDisplayValue(request.time_preference)}</p>
            </div>
          {/if}

          {#if request.contact_preference}
            <div>
              <h3 class="h4 mb-2 font-semibold">Contact Preference</h3>
              <p>{ContactPreferenceHelpers.getDisplayValue(request.contact_preference)}</p>
            </div>
          {/if}
        </div>

        <div>
          <h3 class="h4 mb-2 font-semibold">Interaction Type</h3>
          <p>
            {#if request.interaction_type === InteractionType.InPerson}
              In Person
            {:else if request.interaction_type === InteractionType.Virtual}
              Virtual
            {:else}
              {request.interaction_type}
            {/if}
          </p>
        </div>

        <!-- Links -->
        {#if request.links && request.links.length > 0}
          <div>
            <h3 class="h4 mb-2 font-semibold">Links</h3>
            <ul class="list-inside list-disc">
              {#each request.links as link}
                <li>
                  <a
                    href={link.startsWith('http') ? link : `https://${link}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-500 hover:underline"
                  >
                    {link}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- Organization Information -->
        {#if organization}
          <div>
            <h3 class="h4 mb-2 font-semibold">Organization</h3>
            <a
              href={`/organizations/${encodeHashToBase64(organization.original_action_hash!)}`}
              class="flex items-center gap-3 hover:text-primary-500"
            >
              <Avatar
                src={organizationLogoUrl || '/default_avatar.webp'}
                initials={organization.name?.charAt(0) || 'O'}
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
          </div>
        {/if}

        <!-- Creator Information -->
        {#if creator}
          <div>
            <h3 class="h4 mb-2 font-semibold">Creator</h3>
            <a
              href={`/users/${encodeHashToBase64(request.creator!)}`}
              class="flex items-center gap-3 hover:text-primary-500"
            >
              <Avatar
                src={creatorPictureUrl || '/default_avatar.webp'}
                initials={creator.name?.charAt(0) || 'U'}
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
          </div>
        {/if}

        <!-- Metadata -->
        <div
          class="border-surface-300-600-token grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-3"
        >
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
          <button class="variant-filled-secondary btn" onclick={handleEdit}>Edit</button>
          <button class="variant-filled-error btn" onclick={handleDelete}>Delete</button>
        </div>
      {/if}
    </div>
  {:else}
    <div class="text-center text-xl text-surface-500">Request not found.</div>
  {/if}
</section>
