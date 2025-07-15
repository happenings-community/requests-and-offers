<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import offersStore from '$lib/stores/offers.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import OfferForm from '$lib/components/offers/OfferForm.svelte';
  import ServiceTypesGuard from '$lib/components/service-types/ServiceTypesGuard.svelte';
  import type { OfferInput } from '$lib/types/holochain';
  import type { UIOffer, UIOrganization } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import { Effect as E } from 'effect';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let offer: UIOffer | null = $state(null);
  let userCoordinatedOrganizations: UIOrganization[] = $state([]);

  // Toast store for notifications
  const toastStore = getToastStore();

  // Derived values
  const { currentUser } = $derived(usersStore);
  const offerId = $derived(page.params.id);

  // Check if user can edit the offer
  const canEdit = $derived.by(() => {
    if (!currentUser || !offer) return false;

    // User can edit if they created the offer
    if (offer.creator && currentUser.original_action_hash) {
      return offer.creator.toString() === currentUser.original_action_hash.toString();
    }

    // User can edit if they are an organization coordinator
    if (offer.organization) {
      return userCoordinatedOrganizations.some(
        (org) => org.original_action_hash?.toString() === offer!.organization?.toString()
      );
    }

    return false;
  });

  // Handle form submission
  async function handleSubmit(updatedOffer: OfferInput, organizationHash?: ActionHash) {
    if (!offer?.original_action_hash || !offer?.previous_action_hash) {
      toastStore.trigger({
        message: 'Invalid offer data for update',
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
        message: 'Offer updated successfully!',
        background: 'variant-filled-success'
      });

      // Navigate back to the offer detail page
      goto(`/offers/${offerId}`);
    } catch (err) {
      console.error('Failed to update offer:', err);
      toastStore.trigger({
        message: `Failed to update offer: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

  // Initialize offer data once on mount
  let hasInitialized = false;

  $effect(() => {
    const currentOfferId = offerId;

    if (!currentOfferId) {
      error = 'Invalid offer ID';
      isLoading = false;
      return;
    }

    // Only initialize once per component instance
    if (hasInitialized) {
      return;
    }

    hasInitialized = true;

    async function loadOfferData() {
      isLoading = true;
      error = null;

      try {
        // Decode the offer hash from the URL
        const offerHash = decodeHashFromBase64(currentOfferId);

        // Load the offer (this will use cache if available)
        const fetchedOffer = await runEffect(offersStore.getLatestOffer(offerHash));

        if (!fetchedOffer) {
          error = 'Offer not found';
          offer = null;
          isLoading = false;
          return;
        }

        offer = fetchedOffer;
        isLoading = false;
      } catch (err) {
        console.error('Failed to load offer data:', err);
        error = err instanceof Error ? err.message : 'Failed to load offer data';
        offer = null;
      } finally {
        isLoading = false;
      }
    }

    loadOfferData();
  });

  // Load user organizations - only once per user
  let lastUserHash: string | null = null;

  $effect(() => {
    const user = currentUser;
    const userHash = user?.original_action_hash?.toString() || null;

    if (!user?.original_action_hash) {
      if (userCoordinatedOrganizations.length > 0) {
        userCoordinatedOrganizations = [];
      }
      lastUserHash = null;
      return;
    }

    // Don't reload for the same user
    if (lastUserHash === userHash) {
      return;
    }

    lastUserHash = userHash;

    async function loadUserOrganizations() {
      if (!user) return;

      try {
        const coordinatedOrgs = await E.runPromise(
          organizationsStore.getUserOrganizations(user.original_action_hash!)
        );

        const acceptedOrgs = coordinatedOrgs.filter(
          (org) => org.status?.status_type === 'accepted'
        );

        userCoordinatedOrganizations = acceptedOrgs;
      } catch (err) {
        console.warn('Failed to load coordinated organizations:', err);
        userCoordinatedOrganizations = [];
      }
    }

    loadUserOrganizations();
  });
</script>

<ServiceTypesGuard
  title="Service Types Required for Offers"
  description="Offers must be categorized with service types. Administrators need to create service types before users can edit offers."
>
  <h1 class="h1">Edit Offer</h1>

  <section class="container mx-auto p-4">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="h1">Edit Offer</h1>
      <div class="flex gap-2">
        <button class="variant-soft btn" onclick={() => goto(`/offers/${offerId}`)}>
          Cancel
        </button>
        <button class="variant-soft btn" onclick={() => goto('/offers')}> Back to Offers </button>
      </div>
    </div>

    {#if error}
      <div class="alert variant-filled-error mb-4">
        <p>{error}</p>
      </div>
    {/if}

    {#if !currentUser}
      <div class="text-center text-xl text-surface-500">Please log in to edit offers.</div>
    {:else if isLoading}
      <div class="flex h-64 items-center justify-center">
        <span class="loading loading-spinner text-primary"></span>
        <p class="ml-4">Loading offer...</p>
      </div>
    {:else if !offer}
      <div class="text-center text-xl text-surface-500">Offer not found.</div>
    {:else if !canEdit}
      <div class="alert variant-filled-warning">
        <div class="alert-message">
          <h3 class="h3">Access Denied</h3>
          <p>
            You don't have permission to edit this offer. Only the offer creator or organization
            coordinators can edit offers.
          </p>
        </div>
        <div class="alert-actions">
          <button class="variant-filled btn" onclick={() => goto(`/offers/${offerId}`)}>
            View Offer
          </button>
        </div>
      </div>
    {:else}
      <div class="card variant-soft p-6">
        <OfferForm
          mode="edit"
          {offer}
          organizations={userCoordinatedOrganizations}
          onSubmit={handleSubmit}
        />
      </div>
    {/if}
  </section>
</ServiceTypesGuard>
