<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { decodeHashFromBase64 } from '@holochain/client';
  import type { ActionHash } from '@holochain/client';
  import type { OfferInDHT } from '@/types/holochain';
  import type { UIOffer, UIOrganization } from '@/types/ui';
  import offersStore from '@/stores/offers.store.svelte';
  import usersStore from '@/stores/users.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';
  import OfferForm from '@/lib/components/OfferForm.svelte';

  // Props
  const { id } = $props<{ id: string }>();

  // State
  let loading = $state(true);
  let error = $state<string | null>(null);
  let currentOffer = $state<UIOffer | null>(null);
  let organizations = $state<UIOrganization[]>([]);
  let preselectedOrganization = $state<ActionHash | undefined>(undefined);

  // Toast store for notifications
  const toastStore = getToastStore();

  // Get the current user from the store
  const { currentUser } = $derived(usersStore);

  // Load the offer data
  $effect(() => {
    async function loadOffer() {
      try {
        loading = true;
        error = null;

        if (!id) {
          error = 'Invalid offer ID';
          return;
        }

        let offerHash: ActionHash;
        try {
          // Decode the offer hash from the URL
          offerHash = decodeHashFromBase64(id);
        } catch (err) {
          console.error('Failed to decode offer hash:', err);
          error = 'Invalid offer ID format';
          return;
        }

        // Get the offer details
        const fetchedOffer = await offersStore.getLatestOffer(offerHash);

        if (!fetchedOffer) {
          error = 'Offer not found';
          return;
        }

        currentOffer = fetchedOffer;

        // Check if the user has permission to edit this offer
        if (!currentUser?.original_action_hash || !currentOffer.creator) {
          error = 'You do not have permission to edit this offer';
          return;
        }

        const isCreator =
          currentUser.original_action_hash.toString() === currentOffer.creator.toString();
        const isOrgCoordinator =
          currentOffer.organization &&
          currentUser.organizations?.some(
            (org) => org.toString() === currentOffer!.organization?.toString()
          );

        if (!isCreator && !isOrgCoordinator) {
          error = 'You do not have permission to edit this offer';
          return;
        }

        // Load organizations if needed
        if (currentUser.original_action_hash) {
          await organizationsStore.getUserOrganizations(currentUser.original_action_hash);
        }

        // Set preselected organization if the offer has one
        if (currentOffer.organization) {
          const org = await organizationsStore.getLatestOrganization(currentOffer.organization);
          if (org?.original_action_hash) {
            preselectedOrganization = org.original_action_hash;
          }
        }

        // Load organizations
        organizations = await organizationsStore.getAcceptedOrganizations();
      } catch (err) {
        console.error('Failed to load offer:', err);
        error = err instanceof Error ? err.message : 'Failed to load offer';
      } finally {
        loading = false;
      }
    }

    loadOffer();
  });

  // Handle form submission
  async function handleSubmit(offer: OfferInDHT, organizationHash?: ActionHash) {
    if (!currentOffer?.original_action_hash || !currentOffer?.previous_action_hash) {
      error = 'Missing required offer hashes';
      return;
    }

    updateOffer(offer, organizationHash);
  }

  // Update offer function
  async function updateOffer(offer: OfferInDHT, organizationHash?: ActionHash) {
    try {
      loading = true;
      error = null;

      // Update the offer
      await offersStore.updateOffer(
        currentOffer!.original_action_hash!,
        currentOffer!.previous_action_hash!,
        {
          title: offer.title,
          description: offer.description,
          capabilities: offer.capabilities,
          availability: offer.availability
        }
      );

      // Show success toast
      toastStore.trigger({
        message: 'Offer updated successfully',
        background: 'variant-filled-success'
      });

      // Navigate back to the offer page
      goto(`/offers/${id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      toastStore.trigger({
        message: `Failed to update offer: ${error}`,
        background: 'variant-filled-error'
      });
    } finally {
      loading = false;
    }
  }
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Edit Offer</h1>
    <button class="btn variant-soft" onclick={() => goto(`/offers/${id}`)}> Back to Offer </button>
  </div>

  {#if !currentUser}
    <div class="text-surface-500 text-center text-xl">Please log in to edit offers.</div>
  {:else if loading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading offer details...</p>
    </div>
  {:else if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
    </div>
  {:else if currentOffer && currentOffer.title && currentOffer.description}
    <OfferForm
      mode="edit"
      offer={currentOffer}
      {organizations}
      {preselectedOrganization}
      onSubmit={handleSubmit}
    />
  {:else}
    <div class="text-surface-500 text-center text-xl">Unable to load offer details.</div>
  {/if}
</section>
