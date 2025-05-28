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
  import offersStore from '$lib/stores/offers.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import { formatDate, getUserPictureUrl, getOrganizationLogoUrl } from '$lib/utils';
  import type { UIOffer, UIOrganization, UIUser, ConfirmModalMeta } from '$lib/types/ui';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import OfferCapabilitiesTags from '$lib/components/offers/OfferCapabilitiesTags.svelte';
  import { runEffect } from '$lib/utils/effect';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let offer: UIOffer | null = $state(null);
  let creator: UIUser | null = $state(null);
  let organization: UIOrganization | null = $state(null);

  // Toast and modal stores for notifications
  const toastStore = getToastStore();
  const modalStore = getModalStore();

  // Register the ConfirmModal component
  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  // Derived values
  const { currentUser } = $derived(usersStore);
  const offerId = $derived(page.params.id);
  const creatorPictureUrl = $derived.by(() => (creator ? getUserPictureUrl(creator) : null));
  const organizationLogoUrl = $derived.by(() =>
    organization ? getOrganizationLogoUrl(organization) : null
  );

  // Check if user can edit/delete the offer
  const canEdit = $derived.by(() => {
    if (!currentUser || !offer) return false;

    // User can edit if they created the offer
    if (offer.creator && currentUser.original_action_hash) {
      return offer.creator.toString() === currentUser.original_action_hash.toString();
    }

    // User can edit if they are an organization coordinator
    if (offer.organization && organization?.coordinators) {
      return organization.coordinators.some(
        (coord) => coord.toString() === currentUser.original_action_hash?.toString()
      );
    }

    return false;
  });

  // Format dates
  const createdAt = $derived.by(() => {
    if (!offer?.created_at) return 'Unknown';
    try {
      return formatDate(new Date(Number(offer.created_at)));
    } catch (err) {
      console.error('Error formatting created date:', err);
      return 'Invalid date';
    }
  });

  const updatedAt = $derived.by(() => {
    if (!offer?.updated_at) return 'N/A';
    try {
      return formatDate(new Date(Number(offer.updated_at)));
    } catch (err) {
      console.error('Error formatting updated date:', err);
      return 'Invalid date';
    }
  });

  // Handle edit action
  function handleEdit() {
    goto(`/offers/${offerId}/edit`);
  }

  // Handle delete action
  async function handleDelete() {
    if (!offer?.original_action_hash) return;

    // Create modal settings
    const modalSettings: ModalSettings = {
      type: 'component',
      component: confirmModalComponent,
      meta: {
        message: 'Are you sure you want to delete this offer?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel'
      } as ConfirmModalMeta,
      response: (confirmed: boolean) => {
        if (confirmed) {
          deleteOffer();
        }
      }
    };

    // Open the modal
    modalStore.trigger(modalSettings);
  }

  // Function to actually delete the offer
  async function deleteOffer() {
    if (!offer?.original_action_hash) return;

    try {
      await runEffect(offersStore.deleteOffer(offer.original_action_hash));
      toastStore.trigger({
        message: 'Offer deleted successfully!',
        background: 'variant-filled-success'
      });
      goto('/offers');
    } catch (err) {
      console.error('Failed to delete offer:', err);
      toastStore.trigger({
        message: `Failed to delete offer: ${err instanceof Error ? err.message : String(err)}`,
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

  // Load offer data on component mount
  $effect(() => {
    async function loadOffer() {
      try {
        isLoading = true;
        error = null;

        if (!offerId) {
          error = 'Invalid offer ID';
          return;
        }

        // Decode the offer hash from the URL
        const offerHash = decodeHashFromBase64(offerId);

        const fetchedOffer = await runEffect(offersStore.getLatestOffer(offerHash));
        if (!fetchedOffer) {
          error = 'Offer not found';
          return;
        }

        offer = fetchedOffer;

        // If the offer has a creator, fetch creator details
        if (offer?.creator) {
          creator = await usersStore.getUserByActionHash(offer.creator);
        }

        // If the offer has an organization, fetch organization details
        if (offer?.organization) {
          organization = await organizationsStore.getOrganizationByActionHash(offer.organization);
        }
      } catch (err) {
        console.error('Failed to load offer:', err);
        error = err instanceof Error ? err.message : 'Failed to load offer';
      } finally {
        isLoading = false;
      }
    }

    loadOffer();
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Offer Details</h1>
    <button class="variant-soft btn" onclick={() => goto('/offers')}> Back to Offers </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading offer details...</p>
    </div>
  {:else if offer}
    <div class="bg-surface-100-800-token/90 card variant-soft p-6 backdrop-blur-lg">
      <!-- Header with title and status -->
      <header class="mb-4 flex items-center gap-4">
        <div class="flex-grow">
          <h1 class="h2 font-bold">{offer.title}</h1>
          <p class="text-surface-600-300-token mt-2">{offer.description}</p>
        </div>
      </header>

      <!-- Main content -->
      <div class="space-y-6">
        <!-- Description -->
        <div>
          <h3 class="h4 mb-2 font-semibold">Description</h3>
          <p class="whitespace-pre-line">{offer.description}</p>
        </div>

        <!-- Service Type -->
        <div>
          <h3 class="h4 mb-2 font-semibold">Service Type</h3>
          {#if offer.service_type_action_hash}
            <OfferCapabilitiesTags serviceTypeActionHash={offer.service_type_action_hash} maxVisible={10} />
          {:else if offer.links && offer.links.length > 0}
            <!-- Fallback to links for backward compatibility -->
            <OfferCapabilitiesTags capabilities={offer.links} maxVisible={10} />
          {:else}
            <p class="text-surface-500">No service type specified.</p>
          {/if}
        </div>

        <!-- New Fields: Time and Preferences -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Time Preference -->
          {#if offer.time_preference}
            <div>
              <h3 class="h4 mb-2 font-semibold">Time Preference</h3>
              <p>
                {#if offer.time_preference === 'Morning'}
                  Morning
                {:else if offer.time_preference === 'Afternoon'}
                  Afternoon
                {:else if offer.time_preference === 'Evening'}
                  Evening
                {:else if offer.time_preference === 'NoPreference'}
                  No Preference
                {:else if offer.time_preference === 'Other'}
                  Other
                {:else}
                  {offer.time_preference}
                {/if}
              </p>
            </div>
          {/if}

          <!-- Time Zone -->
          {#if offer.time_zone}
            <div>
              <h3 class="h4 mb-2 font-semibold">Time Zone</h3>
              <p>{offer.time_zone}</p>
            </div>
          {/if}

          <!-- Exchange Preference -->
          {#if offer.exchange_preference}
            <div>
              <h3 class="h4 mb-2 font-semibold">Exchange Preference</h3>
              <p>
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
              </p>
            </div>
          {/if}

          <!-- Interaction Type -->
          {#if offer.interaction_type}
            <div>
              <h3 class="h4 mb-2 font-semibold">Interaction Type</h3>
              <p>
                {#if offer.interaction_type === 'Virtual'}
                  Virtual
                {:else if offer.interaction_type === 'InPerson'}
                  In Person
                {:else}
                  {offer.interaction_type}
                {/if}
              </p>
            </div>
          {/if}
        </div>

        <!-- Links -->
        {#if offer.links && offer.links.length > 0}
          <div>
            <h3 class="h4 mb-2 font-semibold">Links</h3>
            <ul class="list-inside list-disc">
              {#each offer.links as link}
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

        <!-- Organization info (if applicable) -->
        {#if offer.organization}
          <div>
            <h3 class="h4 mb-2 font-semibold">Organization</h3>
            <div class="flex items-center gap-2">
              {#if organization}
                <a
                  href={`/organizations/${encodeHashToBase64(offer.organization)}`}
                  class="hover:text-primary-500 flex items-center gap-3"
                >
                  <Avatar src={organizationLogoUrl!} width="w-12" rounded="rounded-full" />
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
          <!-- Creator info (only show if not an organization offer) -->
          <div>
            <h3 class="h4 mb-2 font-semibold">Creator</h3>
            <div class="flex items-center gap-2">
              {#if creator}
                <a
                  href={`/users/${encodeHashToBase64(offer.creator!)}`}
                  class="hover:text-primary-500 flex items-center gap-3"
                >
                  <Avatar src={getUserPictureUrl(creator)} width="w-12" rounded="rounded-full" />
                  <div>
                    <p class="font-semibold">{creator.name}</p>
                    {#if creator.nickname}
                      <p class="text-surface-600-300-token text-sm">@{creator.nickname}</p>
                    {/if}
                  </div>
                </a>
              {:else}
                <span class="text-surface-500 italic">Unknown creator</span>
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
