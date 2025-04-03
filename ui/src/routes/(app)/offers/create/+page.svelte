<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import offersStore from '@stores/offers.store.svelte';
  import usersStore from '@stores/users.store.svelte';
  import organizationsStore from '@stores/organizations.store.svelte';
  import OfferForm from '@components/OfferForm.svelte';
  import type { OfferInDHT } from '@types/holochain';
  import type { ActionHash } from '@holochain/client';
  import { decodeHashFromBase64 } from '@holochain/client';
  import type { UIOrganization } from '@types/ui';
  import { runEffect } from '@utils/effect';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let preselectedOrganization: UIOrganization | null = $state(null);

  // Toast store for notifications
  const toastStore = getToastStore();

  // Derived values
  const { currentUser } = $derived(usersStore);
  const { acceptedOrganizations } = $derived(organizationsStore);

  // Check if there's an organization parameter in the URL
  const organizationId = $derived(page.url.searchParams.get('organization'));

  // Handle form submission
  async function handleSubmit(offer: OfferInDHT, organizationHash?: ActionHash) {
    try {
      await runEffect(offersStore.createOffer(offer, organizationHash));

      toastStore.trigger({
        message: 'Offer created successfully!',
        background: 'variant-filled-success'
      });

      // Navigate to the offers list
      goto('/offers');
    } catch (err) {
      console.error('Failed to create offer:', err);
      toastStore.trigger({
        message: `Failed to create offer: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

  // Load user organizations and preselected organization on component mount
  async function loadData() {
    try {
      isLoading = true;
      error = null;

      if (currentUser?.original_action_hash) {
        await organizationsStore.getUserOrganizations(currentUser.original_action_hash);
      }

      // If there's an organization ID in the URL, try to load it
      if (organizationId) {
        try {
          const orgHash = decodeHashFromBase64(organizationId);
          preselectedOrganization = await organizationsStore.getLatestOrganization(orgHash);

          // Verify that the user is a member or coordinator of this organization
          if (preselectedOrganization && currentUser?.original_action_hash) {
            const isMember = preselectedOrganization.members.some(
              (member) => member.toString() === currentUser.original_action_hash?.toString()
            );

            const isCoordinator = preselectedOrganization.coordinators.some(
              (coord) => coord.toString() === currentUser.original_action_hash?.toString()
            );

            if (!isMember && !isCoordinator) {
              preselectedOrganization = null;
              console.warn('User is not a member or coordinator of the specified organization');
            }
          }
        } catch (err) {
          console.error('Failed to load preselected organization:', err);
          preselectedOrganization = null;
        }
      }
    } catch (err) {
      console.error('Failed to load organizations:', err);
      error = err instanceof Error ? err.message : 'Failed to load organizations';
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    loadData();
  });
</script>

<section class="container mx-auto p-4">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="h1">Create Offer</h1>
    <button class="btn variant-soft" onclick={() => goto('/offers')}> Back to Offers </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
    </div>
  {/if}

  {#if !currentUser}
    <div class="text-surface-500 text-center text-xl">Please log in to create offers.</div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading...</p>
    </div>
  {:else}
    <div class="card variant-soft p-6">
      <OfferForm
        mode="create"
        organizations={acceptedOrganizations}
        onSubmit={handleSubmit}
        preselectedOrganization={preselectedOrganization?.original_action_hash}
      />
    </div>
  {/if}
</section>
