<script lang="ts">
  import { Avatar } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIOffer, UIOrganization } from '@lib/types/ui';
  import organizationsStore from '@stores/organizations.store.svelte';
  import OfferCapabilitiesTags from '@components/offers/OfferCapabilitiesTags.svelte';

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

  // Determine if offer is editable based on current user
  const isEditable = $derived(false); // TODO: Implement actual logic

  // Handle edit action
  function handleEdit() {
    // TODO: Implement edit navigation or modal
    console.log('Edit offer', offer);
  }

  // Handle delete action
  function handleDelete() {
    // TODO: Implement delete confirmation and action
    console.log('Delete offer', offer);
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
        {#if offer.availability}
          <p class="text-warning-500 text-xs">
            <span class="font-medium">Availability: {offer.availability}</span>
          </p>
        {/if}
        {#if mode === 'expanded'}
          <p class="text-surface-600-300-token opacity-80">
            {offer.description}
          </p>
        {/if}
      </div>
    </div>
  </div>

  {#if mode === 'expanded'}
    <OfferCapabilitiesTags capabilities={offer.capabilities} maxVisible={5} />
  {/if}

  {#if showActions && isEditable}
    <div class="mt-2 flex gap-2">
      <button class="variant-filled-secondary btn btn-sm" onclick={handleEdit}> Edit </button>
      <button class="variant-filled-error btn btn-sm" onclick={handleDelete}> Delete </button>
    </div>
  {/if}
</div>
