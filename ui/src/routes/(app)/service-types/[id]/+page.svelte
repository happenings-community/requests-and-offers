<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { formatDate } from '$lib/utils';
  import type { UIServiceType, UIRequest, UIOffer } from '$lib/types/ui';
  import RequestCard from '$lib/components/requests/RequestCard.svelte';
  import OfferCard from '$lib/components/offers/OfferCard.svelte';

  // Local state
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let serviceType: UIServiceType | null = $state(null);
  let relatedRequests: UIRequest[] = $state([]);
  let relatedOffers: UIOffer[] = $state([]);
  let loadingRelatedContent = $state(false);

  const serviceTypeId = $derived(page.params.id);

  // Formatted display values
  const createdAt = $derived.by(() => {
    if (!serviceType?.created_at) return 'Unknown';
    try {
      return formatDate(new Date(serviceType.created_at));
    } catch (err) {
      console.error('Error formatting created date:', err);
      return 'Invalid date';
    }
  });

  const updatedAt = $derived.by(() => {
    if (!serviceType?.updated_at) return 'N/A';
    try {
      return formatDate(new Date(serviceType.updated_at));
    } catch (err) {
      console.error('Error formatting updated date:', err);
      return 'Invalid date';
    }
  });

  const statusColor = $derived.by(() => {
    if (!serviceType) return 'variant-soft-surface';
    switch (serviceType.status) {
      case 'approved':
        return 'variant-soft-success';
      case 'pending':
        return 'variant-soft-warning';
      case 'rejected':
        return 'variant-soft-error';
      default:
        return 'variant-soft-surface';
    }
  });

  const statusLabel = $derived.by(() => {
    if (!serviceType) return 'Unknown';
    switch (serviceType.status) {
      case 'approved':
        return 'Approved';
      case 'pending':
        return 'Pending Review';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Unknown';
    }
  });

  // Load service type data
  $effect(() => {
    async function loadServiceType() {
      try {
        isLoading = true;
        error = null;

        if (!serviceTypeId) {
          error = 'Invalid service type ID';
          return;
        }

        const hash = decodeHashFromBase64(serviceTypeId);
        const result = await runEffect(serviceTypesStore.getServiceType(hash));

        if (!result) {
          error = 'Service type not found';
          return;
        }

        serviceType = result;

        // Load related requests and offers if approved
        if (result.status === 'approved') {
          await loadRelatedContent(hash);
        }
      } catch (err) {
        console.error('Failed to load service type:', err);
        error = err instanceof Error ? err.message : String(err);
      } finally {
        isLoading = false;
      }
    }

    loadServiceType();
  });

  // Load related requests and offers that use this service type
  async function loadRelatedContent(serviceTypeHash: ActionHash) {
    try {
      loadingRelatedContent = true;

      // Get all requests and offers, then filter by service type
      const [allRequests, allOffers] = await Promise.all([
        runEffect(requestsStore.getAllRequests()),
        runEffect(offersStore.getAllOffers())
      ]);

      // Filter requests and offers that include this service type
      const serviceTypeHashString = serviceTypeHash.toString();

      relatedRequests = allRequests.filter((request) =>
        request.service_type_hashes?.some((hash) => hash.toString() === serviceTypeHashString)
      );

      relatedOffers = allOffers.filter((offer) =>
        offer.service_type_hashes?.some((hash) => hash.toString() === serviceTypeHashString)
      );
    } catch (err) {
      console.warn('Failed to load related content:', err);
      // Don't set error for related content - it's not critical
    } finally {
      loadingRelatedContent = false;
    }
  }

  function handleCopyName() {
    if (serviceType?.name) {
      navigator.clipboard.writeText(serviceType.name);
    }
  }

  function handleCopyHash() {
    if (serviceTypeId) {
      navigator.clipboard.writeText(serviceTypeId);
    }
  }

  function handleRefresh() {
    window.location.reload();
  }
</script>

<svelte:head>
  <title>
    {serviceType ? `${serviceType.name} Service Type` : 'Service Type'} - Requests & Offers
  </title>
  <meta
    name="description"
    content={serviceType
      ? `Details for ${serviceType.name} service type - ${serviceType.description}`
      : 'Service type details'}
  />
</svelte:head>

<section class="container mx-auto space-y-6 p-4">
  <!-- Navigation -->
  <div class="flex items-center justify-between">
    <button class="variant-soft btn" onclick={() => goto('/service-types')}>
      ← Back to Service Types
    </button>

    {#if serviceType}
      <div class="flex gap-2">
        <button
          class="variant-soft-secondary btn btn-sm"
          onclick={handleCopyName}
          title="Copy service type name"
        >
          Copy Name
        </button>
        <button
          class="variant-soft-secondary btn btn-sm"
          onclick={handleCopyHash}
          title="Copy service type hash"
        >
          Copy Hash
        </button>
      </div>
    {/if}
  </div>

  {#if error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
      <div class="alert-actions">
        <button class="variant-filled-primary btn" onclick={handleRefresh}> Retry </button>
      </div>
    </div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading service type...</p>
    </div>
  {:else if serviceType}
    <!-- Main Content -->
    <div class="space-y-6">
      <!-- Header Card -->
      <div class="card p-6">
        <div class="card-header">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex-1">
              <div class="mb-2 flex items-center gap-3">
                <h1 class="h1 text-primary-500">{serviceType.name}</h1>
              </div>
              <p class="text-surface-600 dark:text-surface-400 mb-4 text-lg">
                {serviceType.description}
              </p>
            </div>
          </div>
        </div>

        <!-- Tags Section -->
        {#if serviceType.tags && serviceType.tags.length > 0}
          <section class="border-surface-300 dark:border-surface-600 mt-6 border-t pt-6">
            <h3 class="h4 mb-3 font-semibold">Tags</h3>
            <div class="flex flex-wrap gap-2">
              {#each serviceType.tags as tag}
                <a
                  href={`/tags/${encodeURIComponent(tag)}`}
                  class="variant-soft-primary badge hover:variant-filled-primary cursor-pointer transition-colors"
                  title="View all content tagged with {tag}"
                >
                  {tag}
                </a>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Metadata Section -->
        <section class="border-surface-300 dark:border-surface-600 mt-6 border-t pt-6">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <h3 class="h4 mb-2 font-semibold">Status</h3>
              <span class="chip {statusColor}">
                {statusLabel}
              </span>
            </div>

            <div>
              <h3 class="h4 mb-2 font-semibold">Created</h3>
              <p class="text-surface-600 dark:text-surface-400">{createdAt}</p>
              {#if serviceType.creator}
                <p class="text-surface-500 mt-1 text-xs">
                  by {serviceType.creator.toString().slice(0, 8)}...
                </p>
              {/if}
            </div>

            <div>
              <h3 class="h4 mb-2 font-semibold">Last Updated</h3>
              <p class="text-surface-600 dark:text-surface-400">{updatedAt}</p>
            </div>
          </div>
        </section>
      </div>

      <!-- Related Content -->
      {#if serviceType.status === 'approved'}
        <div class="space-y-6">
          <!-- Related Requests -->
          <div class="card p-6">
            <h3 class="h3 mb-4">
              Requests Using This Service Type
              {#if !loadingRelatedContent}
                <span class="text-surface-500 text-sm">({relatedRequests.length})</span>
              {/if}
            </h3>

            {#if loadingRelatedContent}
              <div class="flex items-center justify-center py-8">
                <span class="loading loading-spinner loading-sm"></span>
                <p class="ml-2">Loading related requests...</p>
              </div>
            {:else if relatedRequests.length === 0}
              <p class="text-surface-500 py-4">
                No requests are currently using this service type.
              </p>
            {:else}
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {#each relatedRequests.slice(0, 6) as request}
                  <RequestCard {request} />
                {/each}
              </div>

              {#if relatedRequests.length > 6}
                <div class="pt-4 text-center">
                  <a
                    href="/requests?service_type={encodeURIComponent(serviceType.name)}"
                    class="variant-soft-primary btn"
                  >
                    View All {relatedRequests.length} Requests
                  </a>
                </div>
              {/if}
            {/if}
          </div>

          <!-- Related Offers -->
          <div class="card p-6">
            <h3 class="h3 mb-4">
              Offers Using This Service Type
              {#if !loadingRelatedContent}
                <span class="text-surface-500 text-sm">({relatedOffers.length})</span>
              {/if}
            </h3>

            {#if loadingRelatedContent}
              <div class="flex items-center justify-center py-8">
                <span class="loading loading-spinner loading-sm"></span>
                <p class="ml-2">Loading related offers...</p>
              </div>
            {:else if relatedOffers.length === 0}
              <p class="text-surface-500 py-4">No offers are currently using this service type.</p>
            {:else}
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {#each relatedOffers.slice(0, 6) as offer}
                  <OfferCard {offer} />
                {/each}
              </div>

              {#if relatedOffers.length > 6}
                <div class="pt-4 text-center">
                  <a
                    href="/offers?service_type={encodeURIComponent(serviceType.name)}"
                    class="variant-soft-primary btn"
                  >
                    View All {relatedOffers.length} Offers
                  </a>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {:else}
        <!-- Status Information for non-approved service types -->
        <div class="card p-6">
          <h3 class="h3 mb-4">Status Information</h3>
          {#if serviceType.status === 'pending'}
            <div class="alert variant-soft-warning">
              <p class="font-semibold">Pending Review</p>
              <p>
                This service type is currently under review by administrators. Once approved, it
                will be available for use in requests and offers.
              </p>
            </div>
          {:else if serviceType.status === 'rejected'}
            <div class="alert variant-soft-error">
              <p class="font-semibold">Rejected</p>
              <p>
                This service type has been rejected by administrators and is not available for use.
              </p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Information Section -->
      <div class="card p-6">
        <h3 class="h3 mb-4">About This Service Type</h3>
        <div class="text-surface-600 dark:text-surface-400 space-y-3">
          <p>
            <strong>{serviceType.name}</strong>
            {#if serviceType.status === 'approved'}
              is an approved service type that can be used to categorize requests and offers in the
              marketplace.
            {:else if serviceType.status === 'pending'}
              is currently being reviewed for approval as a service type category.
            {:else}
              was suggested as a service type but has been rejected.
            {/if}
          </p>

          <p>
            <strong>Description:</strong>
            {serviceType.description}
          </p>

          {#if serviceType.tags && serviceType.tags.length > 0}
            <p>
              <strong>Tags:</strong> Service type is tagged with {serviceType.tags.join(', ')}
              to help with categorization and discovery.
            </p>
          {/if}

          <p>
            When creating requests or offers, users can select this service type to categorize their
            content, making it easier for others to find relevant opportunities and services.
          </p>
        </div>
      </div>

      <!-- Technical Details (for advanced users) -->
      <details class="card p-6">
        <summary class="h4 hover:text-primary-500 cursor-pointer transition-colors">
          Technical Details
        </summary>
        <div class="mt-4 space-y-3 text-sm">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <strong class="text-surface-800 dark:text-surface-200">Original Action Hash:</strong>
              <code
                class="code bg-surface-100 dark:bg-surface-800 mt-1 block break-all rounded p-2 text-xs"
              >
                {serviceType.original_action_hash
                  ? encodeHashToBase64(serviceType.original_action_hash)
                  : 'N/A'}
              </code>
            </div>
            <div>
              <strong class="text-surface-800 dark:text-surface-200">Previous Action Hash:</strong>
              <code
                class="code bg-surface-100 dark:bg-surface-800 mt-1 block break-all rounded p-2 text-xs"
              >
                {serviceType.previous_action_hash
                  ? encodeHashToBase64(serviceType.previous_action_hash)
                  : 'N/A'}
              </code>
            </div>
          </div>

          {#if serviceType.creator}
            <div>
              <strong class="text-surface-800 dark:text-surface-200">Creator Hash:</strong>
              <code
                class="code bg-surface-100 dark:bg-surface-800 mt-1 block break-all rounded p-2 text-xs"
              >
                {serviceType.creator.toString()}
              </code>
            </div>
          {/if}
        </div>
      </details>
    </div>
  {:else}
    <div class="card p-8 text-center">
      <h2 class="h2 mb-4">Service Type Not Found</h2>
      <p class="text-surface-600 dark:text-surface-400 mb-4">
        The requested service type could not be found or may have been removed.
      </p>
      <button class="variant-filled-primary btn" onclick={() => goto('/service-types')}>
        Browse All Service Types
      </button>
    </div>
  {/if}
</section>
