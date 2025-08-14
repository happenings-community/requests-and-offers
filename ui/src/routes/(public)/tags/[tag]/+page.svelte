<script lang="ts">
  import { page } from '$app/state';
  import { runEffect } from '$lib/utils/effect';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';
  import RequestsTable from '$lib/components/requests/RequestsTable.svelte';
  import OffersTable from '$lib/components/offers/OffersTable.svelte';
  import type { UIServiceType, UIRequest, UIOffer } from '$lib/types/ui';

  // Get the tag from the URL parameter
  const tag = $derived(page.params.tag);

  // State
  let pageState = $state({
    isLoading: true,
    error: null as string | null,
    serviceTypes: [] as UIServiceType[],
    requests: [] as UIRequest[],
    offers: [] as UIOffer[]
  });

  // Load data for the tag
  async function loadTagData() {
    if (!tag) return;

    pageState.isLoading = true;
    pageState.error = null;

    try {
      // Load service types, requests, and offers for this tag in parallel
      const [serviceTypes, requests, offers] = await Promise.all([
        runEffect(serviceTypesStore.getServiceTypesByTag(tag)),
        runEffect(requestsStore.getRequestsByTag(tag)),
        runEffect(offersStore.getOffersByTag(tag))
      ]);

      pageState.serviceTypes = serviceTypes;
      pageState.requests = requests;
      pageState.offers = offers;
    } catch (error) {
      pageState.error = error instanceof Error ? error.message : 'Failed to load tag data';
      console.error('Error loading tag data:', error);
    } finally {
      pageState.isLoading = false;
    }
  }

  // Load data when tag changes
  $effect(() => {
    if (tag) {
      loadTagData();
    }
  });
</script>

<svelte:head>
  <title>Tag: {tag} - Requests and Offers</title>
  <meta name="description" content="Explore service types, requests, and offers related to {tag}" />
</svelte:head>

<section class="container mx-auto space-y-8 p-4">
  <!-- Header -->
  <div class="text-center">
    <h1 class="h1 mb-4">
      <span class="text-primary-500">#</span>{tag}
    </h1>
    <p class="text-surface-600">
      Discover everything related to <strong>{tag}</strong>
    </p>
  </div>

  <!-- Loading State -->
  {#if pageState.isLoading}
    <div class="flex items-center justify-center space-x-2 py-12">
      <span class="loading loading-spinner text-primary"></span>
      <span>Loading content for {tag}...</span>
    </div>

    <!-- Error State -->
  {:else if pageState.error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{pageState.error}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={loadTagData}> Try Again </button>
      </div>
    </div>

    <!-- Content -->
  {:else}
    <!-- Statistics -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div class="card p-6 text-center">
        <h3 class="h3 text-primary-500">{pageState.serviceTypes.length}</h3>
        <p class="text-surface-600">Service Types</p>
      </div>
      <div class="card p-6 text-center">
        <h3 class="h3 text-secondary-500">{pageState.requests.length}</h3>
        <p class="text-surface-600">Active Requests</p>
      </div>
      <div class="card p-6 text-center">
        <h3 class="h3 text-tertiary-500">{pageState.offers.length}</h3>
        <p class="text-surface-600">Available Offers</p>
      </div>
    </div>

    <!-- Service Types Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="h2">Service Types</h2>
        {#if pageState.serviceTypes.length > 6}
          <a
            href="/service-types?tag={tag ? encodeURIComponent(tag) : ''}"
            class="variant-soft-primary btn"
          >
            View All ({pageState.serviceTypes.length})
          </a>
        {/if}
      </div>

      {#if pageState.serviceTypes.length === 0}
        <div class="card p-8 text-center">
          <p class="text-surface-600">No service types found with this tag.</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each pageState.serviceTypes.slice(0, 6) as serviceType (serviceType.original_action_hash?.toString() || `${serviceType.name}-${serviceType.description.slice(0, 10)}`)}
            <ServiceTypeCard {serviceType} showActions={false} />
          {/each}
        </div>
      {/if}
    </div>

    <!-- Requests Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="h2">Recent Requests</h2>
        {#if pageState.requests.length > 5}
          <a
            href="/requests?tag={tag ? encodeURIComponent(tag) : ''}"
            class="variant-soft-secondary btn"
          >
            View All ({pageState.requests.length})
          </a>
        {/if}
      </div>

      {#if pageState.requests.length === 0}
        <div class="card p-8 text-center">
          <p class="text-surface-600">No requests found for this tag.</p>
        </div>
      {:else}
        <RequestsTable
          requests={pageState.requests.slice(0, 5)}
          showCreator={true}
          showOrganization={true}
        />
      {/if}
    </div>

    <!-- Offers Section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="h2">Recent Offers</h2>
        {#if pageState.offers.length > 5}
          <a
            href="/offers?tag={tag ? encodeURIComponent(tag) : ''}"
            class="variant-soft-tertiary btn"
          >
            View All ({pageState.offers.length})
          </a>
        {/if}
      </div>

      {#if pageState.offers.length === 0}
        <div class="card p-8 text-center">
          <p class="text-surface-600">No offers found for this tag.</p>
        </div>
      {:else}
        <OffersTable
          offers={pageState.offers.slice(0, 5)}
          showCreator={true}
          showOrganization={true}
        />
      {/if}
    </div>

    <!-- Navigation -->
    <div class="text-center">
      <a href="/service-types" class="variant-soft btn"> Explore All Service Types </a>
    </div>
  {/if}
</section>
