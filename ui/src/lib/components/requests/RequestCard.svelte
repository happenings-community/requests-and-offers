<script lang="ts">
  import { Avatar } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIRequest, UIOrganization } from '$lib/types/ui';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';

  type Props = {
    request: UIRequest;
    mode?: 'compact' | 'expanded';
    showActions?: boolean;
  };

  const { request, mode = 'compact', showActions = false }: Props = $props();

  const creatorPictureUrl = $derived(
    request.creator
      ? '/default_avatar.webp' // For now, use default until we can fetch the actual user
      : '/default_avatar.webp'
  );

  // Organization details
  let organization = $state<UIOrganization | null>(null);
  let loadingOrganization = $state(false);

  $effect(() => {
    if (request.organization) {
      loadOrganization();
    }
  });

  async function loadOrganization() {
    if (!request.organization) return;
    try {
      loadingOrganization = true;
      organization = await organizationsStore.getOrganizationByActionHash(request.organization);
    } catch (error) {
      console.error('Error loading organization:', error);
      organization = null;
    } finally {
      loadingOrganization = false;
    }
  }

  // Navigate to user profile
  function navigateToUserProfile() {
    if (request.creator) {
      goto(`/users/${encodeHashToBase64(request.creator)}`);
    }
  }

  // Determine if request is editable based on current user
  const isEditable = $derived(false); // TODO: Implement actual logic

  // Handle edit action
  function handleEdit() {
    // TODO: Implement edit navigation or modal
    console.log('Edit request', request);
  }

  // Handle delete action
  function handleDelete() {
    // TODO: Implement delete confirmation and action
    console.log('Delete request', request);
  }
</script>

<div
  class="card variant-soft flex flex-col gap-3 p-4
  {mode === 'compact' ? 'text-sm' : 'text-base'}"
>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button class="flex" onclick={navigateToUserProfile}>
        <Avatar src={creatorPictureUrl} width="w-10" rounded="rounded-full" />
      </button>
      <div>
        <h3 class="font-semibold">{request.title}</h3>
        {#if request.organization}
          <p class="text-xs text-primary-500">
            {#if loadingOrganization}
              <span class="font-medium">Loading organization...</span>
            {:else if organization}
              <span class="font-medium">{organization.name}</span>
            {:else}
              <span class="font-medium">Unknown organization</span>
            {/if}
          </p>
        {/if}
        {#if request.date_range?.start || request.date_range?.end}
          <p class="text-xs text-secondary-500">
            <span class="font-medium">
              {#if request.date_range.start && request.date_range.end}
                Timeframe: {new Date(request.date_range.start).toLocaleDateString()} - {new Date(
                  request.date_range.end
                ).toLocaleDateString()}
              {:else if request.date_range.start}
                Starting: {new Date(request.date_range.start).toLocaleDateString()}
              {:else if request.date_range.end}
                Until: {new Date(request.date_range.end).toLocaleDateString()}
              {/if}
            </span>
          </p>
        {:else if request.time_preference}
          <p class="text-xs text-secondary-500">
            <span class="font-medium">
              Time: {request.time_preference === 'NoPreference'
                ? 'No Preference'
                : request.time_preference}
            </span>
          </p>
        {/if}
        <div class="mt-1 flex flex-wrap gap-2">
          {#if request.interaction_type}
            <span class="variant-soft-primary badge"
              >{request.interaction_type === 'InPerson'
                ? 'In Person'
                : request.interaction_type}</span
            >
          {/if}
          {#if request.exchange_preference}
            <span class="variant-soft-secondary badge">
              {#if request.exchange_preference === 'Exchange'}
                Exchange Services
              {:else if request.exchange_preference === 'Arranged'}
                To Be Arranged
              {:else if request.exchange_preference === 'PayItForward'}
                Pay It Forward
              {:else if request.exchange_preference === 'Open'}
                Hit Me Up
              {:else}
                {request.exchange_preference}
              {/if}
            </span>
          {/if}
        </div>
        {#if mode === 'expanded'}
          <p class="text-surface-600-300-token opacity-80">
            {request.description}
          </p>
        {/if}
      </div>
    </div>
  </div>
  {#if request.service_type_hashes && request.service_type_hashes.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each request.service_type_hashes as serviceTypeHash}
        <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} />
      {/each}
    </div>
  {/if}

  {#if showActions && isEditable}
    <div class="mt-2 flex gap-2">
      <button class="variant-filled-secondary btn btn-sm" onclick={handleEdit}> Edit </button>
      <button class="variant-filled-error btn btn-sm" onclick={handleDelete}> Delete </button>
    </div>
  {/if}
</div>
