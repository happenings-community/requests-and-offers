<script lang="ts">
  import { Avatar } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIRequest, UIOrganization } from '$lib/types/ui';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import MediumOfExchangeTag from '$lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte';
  import { TimePreferenceHelpers } from '$lib/types/holochain';
  import { Effect as E } from 'effect';

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
      organization = await E.runPromise(
        organizationsStore.getOrganizationByActionHash(request.organization)
      );
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
              Time: {TimePreferenceHelpers.getDisplayValue(request.time_preference)}
            </span>
          </p>
        {/if}
        <!-- Interaction Type -->
        {#if request.interaction_type}
          <span class="variant-soft-tertiary badge">
            {request.interaction_type === 'Virtual' ? 'Virtual' : 'In Person'}
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Service Types and Medium of Exchange -->
  <div class="flex flex-col gap-2">
    {#if request.service_type_hashes && request.service_type_hashes.length > 0}
      <div>
        <p class="text-surface-600-300-token mb-1 text-xs font-medium">Service Types:</p>
        <div class="flex flex-wrap gap-1">
          {#each request.service_type_hashes.slice(0, 3) as serviceTypeHash}
            <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} />
          {/each}
          {#if request.service_type_hashes.length > 3}
            <span class="variant-soft-surface badge text-xs"
              >+{request.service_type_hashes.length - 3} more</span
            >
          {/if}
        </div>
      </div>
    {/if}

    {#if request.medium_of_exchange_hashes && request.medium_of_exchange_hashes.length > 0}
      <div>
        <p class="text-surface-600-300-token mb-1 text-xs font-medium">Medium of Exchange:</p>
        <div class="flex flex-wrap gap-1">
          {#each request.medium_of_exchange_hashes.slice(0, 2) as mediumHash}
            <MediumOfExchangeTag mediumOfExchangeActionHash={mediumHash} />
          {/each}
          {#if request.medium_of_exchange_hashes.length > 2}
            <span class="variant-soft-surface badge text-xs"
              >+{request.medium_of_exchange_hashes.length - 2} more</span
            >
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if showActions}
    <div class="mt-2 flex gap-2">
      <button
        class="variant-filled-primary btn btn-sm"
        onclick={() => {
          if (request.original_action_hash) {
            goto(`/requests/${encodeHashToBase64(request.original_action_hash)}`);
          }
        }}
      >
        Details
      </button>
    </div>
  {/if}
</div>
