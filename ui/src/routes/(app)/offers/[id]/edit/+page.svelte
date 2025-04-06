<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import offersStore from '@stores/offers.store.svelte';
  import usersStore from '@stores/users.store.svelte';
  import organizationsStore from '@stores/organizations.store.svelte';
  import OfferForm from '@components/offers/OfferForm.svelte';
  import type { OfferInDHT } from '@lib/types/holochain';
  import type { ActionHash } from '@holochain/client';
  import type { UIOffer } from '@lib/types/ui';
  import { runEffect } from '@utils/effect';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let offer: UIOffer | null = $state(null);

  // Toast store for notifications
  const toastStore = getToastStore();

  // Derived values
  const { currentUser } = $derived(usersStore);
  const { acceptedOrganizations } = $derived(organizationsStore);
  const offerId = $derived(page.params.id);

  // Handle form submission
  async function handleSubmit(updatedOffer: OfferInDHT, organizationHash?: ActionHash) {
    if (!offer?.original_action_hash || !offer?.previous_action_hash) {
      toastStore.trigger({
        message: 'Cannot update offer: missing action hashes',
        background: 'variant-filled-error'
      });
      return;
    }

    try {
      await runEffect(
        offersStore.updateOffer(
          offer.original_action_hash,
          offer.previous_action_hash,
          updatedOffer
        )
      );

      toastStore.trigger({
        message: 'Request updated successfully!',
        background: 'variant-filled-success'
      });

      // Navigate back to the request details page
      goto(`/offers/${offerId}`);
    } catch (err) {
      console.error('Failed to update offer:', err);
      toastStore.trigger({
        message: `Failed to update offer: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

  // Load request data and user organizations on component mount
  $effect(() => {
    async function loadData() {
      try {
        isLoading = true;
        error = null;

        if (!offerId) {
          error = 'Invalid offer ID';
          return;
        }

        // Decode the offer hash from the URL
        const offerHash = decodeHashFromBase64(offerId);

        // Fetch the offer
        const fetchedOffer = await runEffect(offersStore.getLatestOffer(offerHash));

        if (!fetchedOffer) {
          error = 'Offer not found';
          return;
        }

        offer = fetchedOffer;

        // Load organizations
        if (currentUser?.original_action_hash) {
          await organizationsStore.getUserOrganizations(currentUser.original_action_hash);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        error = err instanceof Error ? err.message : 'Failed to load data';
      } finally {
        isLoading = false;
      }
    }

    loadData();
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Edit Offer</h1>
    <button class="btn variant-soft" onclick={() => goto(`/offers/${offerId}`)}
      >Back to Offer</button
    >
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
    </div>
  {/if}

  {#if !currentUser}
    <div class="text-surface-500 text-center text-xl">Please log in to edit offers.</div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading...</p>
    </div>
  {:else if offer}
    <div class="card variant-soft p-6">
      <OfferForm
        mode="edit"
        {offer}
        organizations={acceptedOrganizations}
        onSubmit={handleSubmit}
      />
    </div>
  {:else}
    <div class="text-surface-500 text-center text-xl">Offer not found.</div>
  {/if}
</section>
