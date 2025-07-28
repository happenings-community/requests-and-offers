<script lang="ts">
  import { Avatar } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIOffer, UIOrganization } from '$lib/types/ui';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import MediumOfExchangeTag from '$lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte';
  import { TimePreferenceHelpers } from '$lib/types/holochain';
  import { Effect as E } from 'effect';

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
      organization = await E.runPromise(
        organizationsStore.getOrganizationByActionHash(offer.organization)
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
        <a
          href="/offers/{offer.original_action_hash
            ? encodeHashToBase64(offer.original_action_hash)
            : ''}"
          class="hover:underline"
        >
          <h3 class="font-semibold">{offer.title}</h3>
        </a>
        {#if offer.organization}
          <p class="text-primary-500 dark:text-primary-400 text-xs">
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
        <!-- Interaction Type -->
        {#if offer.interaction_type}
          <span class="variant-soft-tertiary badge">
            {offer.interaction_type === 'Virtual' ? 'Virtual' : 'In Person'}
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Service Types and Medium of Exchange -->
  <div class="flex flex-col gap-2">
    {#if offer.service_type_hashes && offer.service_type_hashes.length > 0}
      <div>
        <p class="text-surface-600-300-token mb-1 text-xs font-medium">Service Types:</p>
        <div class="flex flex-wrap gap-1">
          {#each offer.service_type_hashes.slice(0, 3) as serviceTypeHash}
            <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} />
          {/each}
          {#if offer.service_type_hashes.length > 3}
            <span class="variant-soft-surface badge text-xs"
              >+{offer.service_type_hashes.length - 3} more</span
            >
          {/if}
        </div>
      </div>
    {/if}

    {#if offer.medium_of_exchange_hashes && offer.medium_of_exchange_hashes.length > 0}
      <div>
        <p class="text-surface-600-300-token mb-1 text-xs font-medium">Mediums of Exchange:</p>
        <div class="flex flex-wrap gap-1">
          {#each offer.medium_of_exchange_hashes.slice(0, 2) as mediumHash}
            <MediumOfExchangeTag mediumOfExchangeActionHash={mediumHash} />
          {/each}
          {#if offer.medium_of_exchange_hashes.length > 2}
            <span class="variant-soft-surface badge text-xs"
              >+{offer.medium_of_exchange_hashes.length - 2} more</span
            >
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if mode === 'expanded'}
    <div>
      <p class="text-surface-600-300-token opacity-80">
        {offer.description}
      </p>
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
