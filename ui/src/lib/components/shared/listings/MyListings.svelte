<script lang="ts">
  import { onMount } from 'svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import type { UIRequest, UIOffer } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import RequestCard from '$lib/components/requests/RequestCard.svelte';
  import OfferCard from '$lib/components/offers/OfferCard.svelte';
  import { getToastStore } from '@skeletonlabs/skeleton';

  type Props = {
    userId: string;
  };

  // Props
  let { userId }: Props = $props();

  // State
  let requests: UIRequest[] = $state([]);
  let offers: UIOffer[] = $state([]);
  let requestsLoading: boolean = $state(false);
  let offersLoading: boolean = $state(false);
  let requestsError: string | null = $state(null);
  let offersError: string | null = $state(null);

  // Stores
  const toastStore = getToastStore();

  // Load user's listings
  async function loadListings() {
    // Load requests
    requestsLoading = true;
    requestsError = null;
    try {
      const userRequests = await runEffect(requestsStore.getUserRequests(userId as any));
      requests = userRequests;
    } catch (err) {
      console.error('Failed to load user requests:', err);
      requestsError = err instanceof Error ? err.message : 'Unknown error';
      toastStore.trigger({
        message: 'Failed to load your requests',
        background: 'variant-filled-error'
      });
    } finally {
      requestsLoading = false;
    }

    // Load offers
    offersLoading = true;
    offersError = null;
    try {
      const userOffers = await runEffect(offersStore.getUserOffers(userId as any));
      offers = userOffers;
    } catch (err) {
      console.error('Failed to load user offers:', err);
      offersError = err instanceof Error ? err.message : 'Unknown error';
      toastStore.trigger({
        message: 'Failed to load your offers',
        background: 'variant-filled-error'
      });
    } finally {
      offersLoading = false;
    }
  }

  // Initialize
  onMount(() => {
    loadListings();
  });

  // Helper function to count active vs archived listings
  const activeRequests = $derived(requests); // For now, all requests are considered active
  const archivedRequests = $derived([]); // For now, no archived requests
  const activeOffers = $derived(offers); // For now, all offers are considered active
  const archivedOffers = $derived([]); // For now, no archived offers
</script>

<div class="space-y-8">
  <div>
    <h2 class="h2 mb-2">My Listings</h2>
    <p class="text-surface-600 dark:text-surface-400">Manage your requests and offers</p>
  </div>

  <!-- Stats Overview -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
    <div class="card p-4 text-center">
      <p class="text-2xl font-bold text-primary-500">{activeRequests.length}</p>
      <p class="text-sm text-surface-600 dark:text-surface-400">Active Requests</p>
    </div>
    <div class="card p-4 text-center">
      <p class="text-2xl font-bold text-warning-500">{archivedRequests.length}</p>
      <p class="text-sm text-surface-600 dark:text-surface-400">Archived Requests</p>
    </div>
    <div class="card p-4 text-center">
      <p class="text-2xl font-bold text-secondary-500">{activeOffers.length}</p>
      <p class="text-sm text-surface-600 dark:text-surface-400">Active Offers</p>
    </div>
    <div class="card p-4 text-center">
      <p class="text-2xl font-bold text-tertiary-500">{archivedOffers.length}</p>
      <p class="text-sm text-surface-600 dark:text-surface-400">Archived Offers</p>
    </div>
  </div>

  <!-- Requests Section -->
  <section>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="h3">My Requests</h3>
      <a href="/requests/create" class="variant-filled-primary btn btn-sm"> + New Request </a>
    </div>

    {#if requestsLoading}
      <div class="card p-8 text-center">
        <p>Loading your requests...</p>
      </div>
    {:else if requestsError}
      <div class="card p-8 text-center">
        <p class="text-error-500">Failed to load requests: {requestsError}</p>
        <button class="variant-filled-primary btn mt-4" onclick={loadListings}> Retry </button>
      </div>
    {:else if requests.length === 0}
      <div class="card p-8 text-center">
        <p>You haven't created any requests yet.</p>
        <a href="/requests/create" class="variant-filled-primary btn mt-4">
          Create your first request
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        {#each requests as request}
          <RequestCard {request} showActions={true} />
        {/each}
      </div>
    {/if}
  </section>

  <!-- Offers Section -->
  <section>
    <div class="mb-4 flex items-center justify-between">
      <h3 class="h3">My Offers</h3>
      <a href="/offers/create" class="variant-filled-secondary btn btn-sm"> + New Offer </a>
    </div>

    {#if offersLoading}
      <div class="card p-8 text-center">
        <p>Loading your offers...</p>
      </div>
    {:else if offersError}
      <div class="card p-8 text-center">
        <p class="text-error-500">Failed to load offers: {offersError}</p>
        <button class="variant-filled-primary btn mt-4" onclick={loadListings}> Retry </button>
      </div>
    {:else if offers.length === 0}
      <div class="card p-8 text-center">
        <p>You haven't created any offers yet.</p>
        <a href="/offers/create" class="variant-filled-secondary btn mt-4">
          Create your first offer
        </a>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        {#each offers as offer}
          <OfferCard {offer} showActions={true} />
        {/each}
      </div>
    {/if}
  </section>
</div>
