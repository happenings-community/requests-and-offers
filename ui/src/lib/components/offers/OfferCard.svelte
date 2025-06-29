<script lang="ts">
  import { Avatar } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIOffer, UIOrganization } from '$lib/types/ui';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import { TimePreferenceHelpers } from '$lib/types/holochain';

  type Props = {
    offer: UIOffer;
    mode?: 'compact' | 'expanded';
    showActions?: boolean;
  };

  const { offer, mode = 'compact', showActions = false }: Props = $props();

  const creatorPictureUrl = $derived(
    offer.creator
      ? '/default_avatar.webp' // For now, use default until we can fetch the actual user
      : '/default_avatar.webp'
  );

  // Organization details
  let organization = $state<UIOrganization | null>(null);
  let loadingOrganization = $state(false);

  $effect(() => {
    if (offer.organization) {
      loadOrganization();
    }
  });

  async function loadOrganization() {
    if (!offer.organization) return;
    try {
      loadingOrganization = true;
      organization = await organizationsStore.getOrganizationByActionHash(offer.organization);
    } catch (error) {
      console.error('Error loading organization:', error);
      organization = null;
    } finally {
      loadingOrganization = false;
    }
  }

  // Navigate to user profile
  function navigateToUserProfile() {
    if (offer.creator) {
      goto(`/users/${encodeHashToBase64(offer.creator)}`);
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
        <h3 class="font-semibold">{offer.title}</h3>
        {#if offer.organization}
          <p class="text-primary-500 text-xs">
            {#if loadingOrganization}
              <span class="font-medium">Loading organization...</span>
            {:else if organization}
              <span class="font-medium">{organization.name}</span>
            {:else}
              <span class="font-medium">Unknown organization</span>
            {/if}
          </p>
        {/if}
        {#if offer.time_preference}
          <p class="text-secondary-500 text-xs">
            <span class="font-medium">
              Time: {TimePreferenceHelpers.getDisplayValue(offer.time_preference)}
            </span>
          </p>
        {/if}
        <div class="mt-1 flex flex-wrap gap-2">
          {#if offer.interaction_type}
            <span class="badge variant-soft-primary"
              >{offer.interaction_type === 'InPerson' ? 'In Person' : offer.interaction_type}</span
            >
          {/if}
          {#if offer.exchange_preference}
            <span class="badge variant-soft-secondary">
              {#if offer.exchange_preference === 'Exchange'}
                Exchange Services
              {:else if offer.exchange_preference === 'Arranged'}
                To Be Arranged
              {:else if offer.exchange_preference === 'PayItForward'}
                Pay It Forward
              {:else if offer.exchange_preference === 'Open'}
                Hit Me Up
              {:else}
                {offer.exchange_preference}
              {/if}
            </span>
          {/if}
        </div>
        {#if mode === 'expanded'}
          <p class="text-surface-600-300-token opacity-80">
            {offer.description}
          </p>
        {/if}
      </div>
    </div>
  </div>

  {#if offer.service_type_hashes && offer.service_type_hashes.length > 0}
    <div class="flex flex-wrap gap-2">
      {#each offer.service_type_hashes as serviceTypeHash}
        <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} />
      {/each}
    </div>
  {/if}

  {#if showActions}
    <div class="mt-2 flex gap-2">
      <button
        class="variant-filled-primary btn btn-sm"
        onclick={() => {
          if (offer.original_action_hash) {
            goto(`/offers/${encodeHashToBase64(offer.original_action_hash)}`);
          }
        }}
      >
        Details
      </button>
    </div>
  {/if}
</div>
