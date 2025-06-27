<script lang="ts">
  import { Avatar, getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import { encodeHashToBase64 } from '@holochain/client';
  import { formatDate, getUserPictureUrl, getOrganizationLogoUrl } from '$lib/utils';
  import { ContactPreferenceHelpers, TimePreferenceHelpers } from '$lib/types/holochain';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import { useRequestDetails } from '$lib/composables';
  import type { ConfirmModalMeta } from '$lib/types/ui';

  // Initialize the composable with all logic
  const requestDetails = useRequestDetails({

    backRoute: '/requests'
  });

  // Destructure for template convenience
  const {
    isLoading,
    error,
    request,
    creator,
    organization,
    serviceTypeHashes,
    canEdit,
    navigateBack,
    navigateToEdit,
    deleteRequest,
    refreshData
  } = $derived(requestDetails);


  // Modal store for confirmations
  const modalStore = getModalStore();

  // Register the ConfirmModal component
  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  // Handle delete with confirmation
  async function handleDelete() {
    const confirmed = await new Promise<boolean>((resolve) => {
      modalStore.trigger({
        type: 'component',
        component: confirmModalComponent,
        meta: {
          message:
            'Are you sure you want to delete this request?<br/>This action cannot be undone.',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel'
        } as ConfirmModalMeta,
        response: (result: boolean) => resolve(result)
      });
    });

    if (confirmed) {
      await deleteRequest();
    }
  }

  // Derived values for UI
  const creatorPictureUrl = $derived.by(() => (creator ? getUserPictureUrl(creator) : null));
  const organizationLogoUrl = $derived.by(() =>
    organization ? getOrganizationLogoUrl(organization) : null
  );

  // Format dates safely
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
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Request Details</h1>
    <button class="variant-soft btn" onclick={navigateBack}>Back to Requests</button>
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={refreshData}>Try Again</button>
        <button class="btn btn-sm" onclick={navigateBack}>Back to Requests</button>
      </div>
    </div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading request details...</p>
    </div>
  {:else if request}
    <div class="bg-surface-100-800-token/90 card variant-soft p-6 backdrop-blur-lg">
      <!-- Header with title and actions -->
      <header class="mb-4 flex items-center gap-4">
        <div class="flex-grow">
          <h1 class="h2 font-bold">{request.title}</h1>
          <p class="text-surface-600-300-token mt-2">{request.description}</p>
        </div>

        {#if canEdit}
          <div class="flex gap-2">
            <button class="variant-soft-primary btn" onclick={navigateToEdit}>Edit</button>
            <button class="variant-soft-error btn" onclick={handleDelete}>Delete</button>
          </div>
        {/if}
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

        <!-- Date Range, Time, and Preferences -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Date Range -->
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

          <!-- Time Estimate -->
          {#if request.time_estimate_hours !== undefined}
            <div>
              <h3 class="h4 mb-2 font-semibold">Time Estimate</h3>
              <p>{request.time_estimate_hours} hours</p>
            </div>
          {/if}

          <!-- Time Preference -->
          {#if request.time_preference}
            <div>
              <h3 class="h4 mb-2 font-semibold">Time Preference</h3>
              <p>{TimePreferenceHelpers.getDisplayValue(request.time_preference)}</p>
            </div>
          {/if}

          <!-- Time Zone -->
          {#if request.time_zone}
            <div>
              <h3 class="h4 mb-2 font-semibold">Time Zone</h3>
              <p>{request.time_zone}</p>
            </div>
          {/if}
        </div>

        <!-- Contact and Exchange Preferences -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Contact Preference -->
          {#if request.contact_preference}
            <div>
              <h3 class="h4 mb-2 font-semibold">Contact Preference</h3>
              <p>{ContactPreferenceHelpers.getDisplayValue(request.contact_preference)}</p>
            </div>
          {/if}

          <!-- Exchange Preference -->
          {#if request.exchange_preference}
            <div>
              <h3 class="h4 mb-2 font-semibold">Exchange Preference</h3>
              <p class="capitalize">{request.exchange_preference}</p>
            </div>
          {/if}
        </div>

        <!-- Creator and Organization Info -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Creator -->
          {#if creator}
            <div class="card variant-soft p-4">
              <h4 class="h4 mb-2">Created by</h4>
              <div class="flex items-center space-x-3">
                <Avatar
                  src={creatorPictureUrl || '/default_avatar.webp'}
                  width="w-12"
                  rounded="rounded-full"
                />
                <div>
                  <p class="font-semibold">{creator.name}</p>
                  <p class="text-surface-500 text-sm">on {createdAt}</p>
                </div>
              </div>
            </div>
          {/if}

          <!-- Organization -->
          {#if organization}
            <div class="card variant-soft p-4">
              <h4 class="h4 mb-2">Organization</h4>
              <div class="flex items-center space-x-3">
                <Avatar
                  src={organizationLogoUrl || '/default_avatar.webp'}
                  width="w-12"
                  rounded="rounded-full"
                />
                <div>
                  <p class="font-semibold">{organization.name}</p>
                  <p class="text-surface-500 text-sm">{organization.description}</p>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Metadata -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="card variant-soft p-4">
            <h4 class="h4 mb-2">Created</h4>
            <p class="text-sm">{createdAt}</p>
          </div>

          <div class="card variant-soft p-4">
            <h4 class="h4 mb-2">Last Updated</h4>
            <p class="text-sm">{updatedAt}</p>
          </div>
        </div>

        <!-- Technical Details (for debugging/admin purposes) -->
        <details class="card variant-soft p-4">
          <summary class="h4 cursor-pointer">Technical Details</summary>
          <div class="mt-4 space-y-2 text-xs">
            <div>
              <strong>Original Action Hash:</strong>
              <code class="code break-all text-xs">
                {request.original_action_hash
                  ? encodeHashToBase64(request.original_action_hash)
                  : 'N/A'}
              </code>
            </div>
            <div>
              <strong>Previous Action Hash:</strong>
              <code class="code break-all text-xs">
                {request.previous_action_hash
                  ? encodeHashToBase64(request.previous_action_hash)
                  : 'N/A'}
              </code>
            </div>
            {#if creator && request.creator}
              <div>
                <strong>Creator Hash:</strong>
                <code class="code break-all text-xs">
                  {encodeHashToBase64(request.creator)}
                </code>
              </div>
            {/if}
            {#if organization && request.organization}
              <div>
                <strong>Organization Hash:</strong>
                <code class="code break-all text-xs">
                  {encodeHashToBase64(request.organization)}
                </code>
              </div>
            {/if}
          </div>
        </details>
      </div>
    </div>
  {:else}
    <div class="text-surface-500 text-center text-xl">Request not found.</div>
  {/if}
</section>
