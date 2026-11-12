<script lang="ts">
  import { onMount } from 'svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import MyListingCard from './MyListingCard.svelte';
  import {
    listingCounts,
    listingsFor,
    type ListingView,
    type MyListingSets
  } from '$lib/utils/my-listings';

  /**
   * My Listings (#344), as the design system lays it out: count cards that
   * choose the view (active requests, active offers, archived), then the
   * listings as managed cards.
   */
  let { userHash }: { userHash: Uint8Array } = $props();

  const VIEWS: { key: ListingView; label: string; icon: string; blurb: string; ring: string }[] = [
    {
      key: 'requests',
      label: 'Active requests',
      icon: '\u{1F4DD}',
      blurb: 'What you are asking for.',
      ring: 'ring-secondary-500'
    },
    {
      key: 'offers',
      label: 'Active offers',
      icon: '\u{1F4A1}',
      blurb: 'What you are offering.',
      ring: 'ring-warning-500'
    },
    {
      key: 'archived',
      label: 'Archived',
      icon: '\u{1F4E6}',
      blurb: 'Requests and offers you have archived.',
      ring: 'ring-surface-500'
    }
  ];

  let view = $state<ListingView>('requests');
  let sets = $state<MyListingSets>({
    activeRequests: [],
    activeOffers: [],
    archivedRequests: [],
    archivedOffers: []
  });
  let loading = $state(true);
  let error = $state<string | null>(null);

  const canCreate = $derived(usersStore.currentUser?.status?.status_type === 'accepted');
  const counts = $derived(listingCounts(sets));
  const shown = $derived(listingsFor(view, sets));

  async function load() {
    error = null;
    try {
      const [activeRequests, activeOffers, archivedRequests, archivedOffers] = await Promise.all([
        runEffect(requestsStore.getUserActiveRequests(userHash)),
        runEffect(offersStore.getUserActiveOffers(userHash)),
        runEffect(requestsStore.getUserArchivedRequests(userHash)),
        runEffect(offersStore.getUserArchivedOffers(userHash))
      ]);
      sets = { activeRequests, activeOffers, archivedRequests, archivedOffers };
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    load();
    // For where each interest's exchange stands. If this read fails, Send a
    // proposal shows where a status would have.
    runEffect(exchangesStore.loadMyExchanges()).catch(() => {});
  });

  const emptyText: Record<ListingView, string> = {
    requests: "You haven't posted any requests yet.",
    offers: "You haven't posted any offers yet.",
    archived: "You haven't archived anything."
  };
</script>

<div class="space-y-6">
  {#if canCreate}
    <div class="flex flex-wrap justify-end gap-2">
      <a href="/requests/create" class="variant-filled-secondary btn btn-sm">+ Request</a>
      <a href="/offers/create" class="variant-filled-warning btn btn-sm">+ Offer</a>
    </div>
  {/if}

  <div class="grid gap-4 md:grid-cols-3" role="tablist" aria-label="Listing views">
    {#each VIEWS as v (v.key)}
      <button
        class="card space-y-2 p-4 text-left transition-colors hover:bg-surface-100 dark:hover:bg-surface-700 {view ===
        v.key
          ? `ring-2 ${v.ring}`
          : ''}"
        role="tab"
        aria-selected={view === v.key}
        onclick={() => (view = v.key)}
      >
        <div class="flex items-start justify-between">
          <span class="text-2xl">{v.icon}</span>
          <span class="text-3xl font-bold">{loading ? '…' : counts[v.key]}</span>
        </div>
        <h2 class="h4">{v.label}</h2>
        <p class="text-sm text-surface-500">{v.blurb}</p>
      </button>
    {/each}
  </div>

  {#if error}
    <div class="card space-y-3 p-6 text-center">
      <p>Couldn't load your listings.</p>
      <p class="text-sm text-surface-500">{error}</p>
      <button class="variant-filled-primary btn" onclick={load}>Try again</button>
    </div>
  {:else if loading}
    <p class="text-surface-500">Loading your listings...</p>
  {:else if shown.length === 0}
    <div class="card space-y-3 p-6 text-center">
      <p class="text-surface-500">{emptyText[view]}</p>
      {#if canCreate && view === 'requests'}
        <a href="/requests/create" class="variant-filled-secondary btn">Create a request</a>
      {:else if canCreate && view === 'offers'}
        <a href="/offers/create" class="variant-filled-warning btn">Create an offer</a>
      {/if}
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      {#each shown as item (item.kind + item.listing.original_action_hash.toString())}
        <MyListingCard {item} onChanged={load} />
      {/each}
    </div>
  {/if}
</div>
