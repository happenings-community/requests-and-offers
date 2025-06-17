<script lang="ts">
    import { runEffect } from '$lib/utils/effect';
    import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
    import requestsStore from '$lib/stores/requests.store.svelte';
    import offersStore from '$lib/stores/offers.store.svelte';
    import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';
    import RequestsTable from '$lib/components/requests/RequestsTable.svelte';
    import OffersTable from '$lib/components/offers/OffersTable.svelte';
    import TagCloud from '$lib/components/shared/TagCloud.svelte';
    import type { UIServiceType, UIRequest, UIOffer } from '$lib/types/ui';
  
    // Props
    let { 
      tag,
      showStatistics = true,
      showRelatedTags = true,
      maxServiceTypes = 6,
      maxRequests = 5,
      maxOffers = 5,
      enableNavigation = true
    } = $props<{
      tag: string;
      showStatistics?: boolean;
      showRelatedTags?: boolean;
      maxServiceTypes?: number;
      maxRequests?: number;
      maxOffers?: number;
      enableNavigation?: boolean;
    }>();
  
    // State
    let state = $state({
      isLoading: true,
      error: null as string | null,
      serviceTypes: [] as UIServiceType[],
      requests: [] as UIRequest[],
      offers: [] as UIOffer[],
      relatedTags: [] as Array<[string, number]>,
      initialized: false
    });
  
    // Derived values
    const hasData = $derived(
      state.serviceTypes.length > 0 || 
      state.requests.length > 0 || 
      state.offers.length > 0
    );
  
    const totalCount = $derived(
      state.serviceTypes.length + state.requests.length + state.offers.length
    );
  
    // Load all data for the tag
    async function loadTagData() {
      if (!tag || state.initialized) return;
  
      state.isLoading = true;
      state.error = null;
  
      try {
        // Load core data in parallel
        const [serviceTypes, requests, offers] = await Promise.all([
          runEffect(serviceTypesStore.getServiceTypesByTag(tag)),
          runEffect(requestsStore.getRequestsByTag(tag)),
          runEffect(offersStore.getOffersByTag(tag))
        ]);
  
        state.serviceTypes = serviceTypes;
        state.requests = requests;
        state.offers = offers;
  
        // Load related tags if enabled
        if (showRelatedTags) {
          try {
            const tagStats = await runEffect(serviceTypesStore.getTagStatistics());
            // Filter out current tag and get related ones
            state.relatedTags = tagStats
              .filter(([tagName]) => tagName !== tag)
              .slice(0, 10); // Top 10 related tags
          } catch (relatedTagsError) {
            console.warn('Failed to load related tags:', relatedTagsError);
            state.relatedTags = [];
          }
        }
  
        state.initialized = true;
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Failed to load tag data';
        console.error('Error loading tag data:', error);
      } finally {
        state.isLoading = false;
      }
    }
  
    // Reload data
    function reloadData() {
      state.initialized = false;
      loadTagData();
    }
  
    // Load data when tag changes
    $effect(() => {
      if (tag) {
        loadTagData();
      }
    });
  
    // Reset when tag changes
    $effect(() => {
      if (tag) {
        state.initialized = false;
        state.serviceTypes = [];
        state.requests = [];
        state.offers = [];
        state.relatedTags = [];
      }
    });
  </script>
  
  <!-- Loading State -->
  {#if state.isLoading}
    <div class="flex items-center justify-center space-x-2 py-12">
      <span class="loading loading-spinner text-primary"></span>
      <span>Loading content for <strong>{tag}</strong>...</span>
    </div>
  
  <!-- Error State -->
  {:else if state.error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error Loading Tag Data</h3>
        <p>{state.error}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm variant-soft" onclick={reloadData}>
          Try Again
        </button>
      </div>
    </div>
  
  <!-- No Data State -->
  {:else if !hasData}
    <div class="card p-8 text-center">
      <h3 class="h3 text-surface-500">No Content Found</h3>
      <p class="text-surface-600 mb-4">
        No service types, requests, or offers are currently associated with 
        <strong class="text-primary-500">#{tag}</strong>
      </p>
      {#if enableNavigation}
        <a href="/service-types" class="btn variant-soft-primary">
          Explore Service Types
        </a>
      {/if}
    </div>
  
  <!-- Content -->
  {:else}
    <div class="space-y-8">
      <!-- Statistics -->
      {#if showStatistics}
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="card bg-primary-50 dark:bg-primary-900/20 p-6 text-center">
            <h3 class="h3 text-primary-500">{state.serviceTypes.length}</h3>
            <p class="text-surface-600">Service Types</p>
          </div>
          <div class="card bg-secondary-50 dark:bg-secondary-900/20 p-6 text-center">
            <h3 class="h3 text-secondary-500">{state.requests.length}</h3>
            <p class="text-surface-600">Active Requests</p>
          </div>
          <div class="card bg-tertiary-50 dark:bg-tertiary-900/20 p-6 text-center">
            <h3 class="h3 text-tertiary-500">{state.offers.length}</h3>
            <p class="text-surface-600">Available Offers</p>
          </div>
        </div>
      {/if}
  
      <!-- Service Types Section -->
      {#if state.serviceTypes.length > 0}
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="h2 flex items-center gap-2">
              <span class="text-primary-500">🎯</span>
              Service Types
            </h2>
            {#if enableNavigation && state.serviceTypes.length > maxServiceTypes}
              <a 
                href="/service-types?tag={encodeURIComponent(tag)}" 
                class="btn variant-soft-primary btn-sm"
              >
                View All ({state.serviceTypes.length})
              </a>
            {/if}
          </div>
  
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each state.serviceTypes.slice(0, maxServiceTypes) as serviceType (serviceType.original_action_hash?.toString() || `${serviceType.name}-${serviceType.description.slice(0, 10)}`)}
              <ServiceTypeCard {serviceType} showActions={false} />
            {/each}
          </div>
        </div>
      {/if}
  
      <!-- Requests Section -->
      {#if state.requests.length > 0}
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="h2 flex items-center gap-2">
              <span class="text-secondary-500">📝</span>
              Recent Requests
            </h2>
            {#if enableNavigation && state.requests.length > maxRequests}
              <a 
                href="/requests?tag={encodeURIComponent(tag)}" 
                class="btn variant-soft-secondary btn-sm"
              >
                View All ({state.requests.length})
              </a>
            {/if}
          </div>
  
          <RequestsTable 
            requests={state.requests.slice(0, maxRequests)} 
            showCreator={true} 
            showOrganization={true}
          />
        </div>
      {/if}
  
      <!-- Offers Section -->
      {#if state.offers.length > 0}
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="h2 flex items-center gap-2">
              <span class="text-tertiary-500">💡</span>
              Recent Offers
            </h2>
            {#if enableNavigation && state.offers.length > maxOffers}
              <a 
                href="/offers?tag={encodeURIComponent(tag)}" 
                class="btn variant-soft-tertiary btn-sm"
              >
                View All ({state.offers.length})
              </a>
            {/if}
          </div>
  
          <OffersTable 
            offers={state.offers.slice(0, maxOffers)} 
            showCreator={true} 
            showOrganization={true}
          />
        </div>
      {/if}
  
      <!-- Related Tags Section -->
      {#if showRelatedTags && state.relatedTags.length > 0}
        <div class="space-y-4">
          <h2 class="h2 flex items-center gap-2">
            <span class="text-warning-500">🏷️</span>
            Related Tags
          </h2>
          
          <div class="card p-6">
            <TagCloud 
              onTagClick={(clickedTag) => {
                if (enableNavigation) {
                  window.location.href = `/tags/${encodeURIComponent(clickedTag)}`;
                }
              }}
              maxTags={10}
            />
          </div>
        </div>
      {/if}
  
      <!-- Summary -->
      <div class="card bg-surface-100 dark:bg-surface-800 p-6 text-center">
        <p class="text-surface-600">
          Found <strong class="text-primary-500">{totalCount}</strong> items related to 
          <strong class="text-primary-500">#{tag}</strong>
        </p>
        
        {#if enableNavigation}
          <div class="mt-4 flex flex-wrap justify-center gap-2">
            <a href="/service-types" class="btn variant-soft-primary btn-sm">
              All Service Types
            </a>
            <a href="/requests" class="btn variant-soft-secondary btn-sm">
              All Requests
            </a>
            <a href="/offers" class="btn variant-soft-tertiary btn-sm">
              All Offers
            </a>
          </div>
        {/if}
      </div>
    </div>
  {/if}