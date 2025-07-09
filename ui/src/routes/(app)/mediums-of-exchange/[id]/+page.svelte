<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { formatDate } from '$lib/utils';
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
  import type { UIRequest, UIOffer } from '$lib/types/ui';
  import RequestCard from '$lib/components/requests/RequestCard.svelte';
  import OfferCard from '$lib/components/offers/OfferCard.svelte';

  // Local state
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let mediumOfExchange: UIMediumOfExchange | null = $state(null);
  let relatedRequests: UIRequest[] = $state([]);
  let relatedOffers: UIOffer[] = $state([]);
  let loadingRelatedContent = $state(false);

  const mediumId = $derived(page.params.id);

  // Formatted display values
  const createdAt = $derived.by(() => {
    if (!mediumOfExchange?.createdAt) return 'Unknown';
    try {
      return formatDate(mediumOfExchange.createdAt);
    } catch (err) {
      console.error('Error formatting created date:', err);
      return 'Invalid date';
    }
  });

  const updatedAt = $derived.by(() => {
    if (!mediumOfExchange?.updatedAt) return 'N/A';
    try {
      return formatDate(mediumOfExchange.updatedAt);
    } catch (err) {
      console.error('Error formatting updated date:', err);
      return 'Invalid date';
    }
  });

  const statusColor = $derived.by(() => {
    if (!mediumOfExchange) return 'variant-soft-surface';
    switch (mediumOfExchange.status) {
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
    if (!mediumOfExchange) return 'Unknown';
    switch (mediumOfExchange.status) {
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

  // Load medium of exchange data
  $effect(() => {
    async function loadMediumOfExchange() {
      try {
        isLoading = true;
        error = null;

        if (!mediumId) {
          error = 'Invalid medium of exchange ID';
          return;
        }

        const hash = decodeHashFromBase64(mediumId);
        const result = await runEffect(mediumsOfExchangeStore.getMediumOfExchange(hash));

        if (!result) {
          error = 'Medium of exchange not found';
          return;
        }

        mediumOfExchange = result;

        // Load related requests and offers if approved
        if (result.status === 'approved') {
          await loadRelatedContent(hash);
        }
      } catch (err) {
        console.error('Failed to load medium of exchange:', err);
        error = err instanceof Error ? err.message : String(err);
      } finally {
        isLoading = false;
      }
    }

    loadMediumOfExchange();
  });

  // Load related requests and offers that use this medium of exchange
  async function loadRelatedContent(mediumHash: ActionHash) {
    try {
      loadingRelatedContent = true;

      // Note: This is a simplified approach. In a real implementation,
      // you might want to add specific methods to get entities by medium of exchange
      const [allRequests, allOffers] = await Promise.all([
        runEffect(requestsStore.getAllRequests()),
        runEffect(offersStore.getAllOffers())
      ]);

      // Filter requests and offers that include this medium of exchange
      const mediumHashString = mediumHash.toString();

      relatedRequests = allRequests.filter((request) =>
        request.medium_of_exchange_hashes?.some((hash) => hash.toString() === mediumHashString)
      );

      relatedOffers = allOffers.filter((offer) =>
        offer.medium_of_exchange_hashes?.some((hash) => hash.toString() === mediumHashString)
      );
    } catch (err) {
      console.warn('Failed to load related content:', err);
      // Don't set error for related content - it's not critical
    } finally {
      loadingRelatedContent = false;
    }
  }

  function handleCopyCode() {
    if (mediumOfExchange?.code) {
      navigator.clipboard.writeText(mediumOfExchange.code);
    }
  }

  function handleCopyHash() {
    if (mediumId) {
      navigator.clipboard.writeText(mediumId);
    }
  }
</script>

<svelte:head>
  <title>
    {mediumOfExchange
      ? `${mediumOfExchange.code} - ${mediumOfExchange.name}`
      : 'Medium of Exchange'} - Requests & Offers
  </title>
  <meta
    name="description"
    content={mediumOfExchange
      ? `Details for ${mediumOfExchange.name} (${mediumOfExchange.code}) medium of exchange`
      : 'Medium of exchange details'}
  />
</svelte:head>

<section class="container mx-auto space-y-6 p-4">
  <!-- Navigation -->
  <div class="flex items-center justify-between">
    <button class="variant-soft btn" onclick={() => goto('/mediums-of-exchange')}>
      ← Back to Mediums of Exchange
    </button>

    {#if mediumOfExchange}
      <div class="flex gap-2">
        <button
          class="btn btn-sm variant-soft-secondary"
          onclick={handleCopyCode}
          title="Copy medium code"
        >
          Copy Code
        </button>
        <button
          class="btn btn-sm variant-soft-secondary"
          onclick={handleCopyHash}
          title="Copy medium hash"
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
        <button class="btn variant-filled-primary" onclick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    </div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading medium of exchange...</p>
    </div>
  {:else if mediumOfExchange}
    <!-- Main Content -->
    <div class="space-y-6">
      <!-- Header Card -->
      <div class="card p-6">
        <div class="card-header">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex-1">
              <div class="mb-2 flex items-center gap-3">
                <h1 class="h1 text-primary-500">{mediumOfExchange.code}</h1>
                <span class="chip {statusColor} text-sm">
                  {statusLabel}
                </span>
              </div>
              <h2 class="h2 mb-4">{mediumOfExchange.name}</h2>

              {#if mediumOfExchange.resourceSpecHreaId}
                <div class="text-surface-600 dark:text-surface-400 text-sm">
                  <p>
                    <strong>hREA Resource Spec ID:</strong>
                    {mediumOfExchange.resourceSpecHreaId}
                  </p>
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Metadata Section -->
        <section class="card-footer border-surface-300 dark:border-surface-600 mt-6 border-t pt-6">
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
            </div>

            <div>
              <h3 class="h4 mb-2 font-semibold">Last Updated</h3>
              <p class="text-surface-600 dark:text-surface-400">{updatedAt}</p>
            </div>
          </div>
        </section>
      </div>

      <!-- Related Content -->
      {#if mediumOfExchange.status === 'approved'}
        <div class="space-y-6">
          <!-- Related Requests -->
          <div class="card p-6">
            <h3 class="h3 mb-4">
              Requests Using This Medium
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
                No requests are currently using this medium of exchange.
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
                    href="/requests?medium={encodeURIComponent(mediumOfExchange.code)}"
                    class="btn variant-soft-primary"
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
              Offers Using This Medium
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
              <p class="text-surface-500 py-4">
                No offers are currently using this medium of exchange.
              </p>
            {:else}
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {#each relatedOffers.slice(0, 6) as offer}
                  <OfferCard {offer} />
                {/each}
              </div>

              {#if relatedOffers.length > 6}
                <div class="pt-4 text-center">
                  <a
                    href="/offers?medium={encodeURIComponent(mediumOfExchange.code)}"
                    class="btn variant-soft-primary"
                  >
                    View All {relatedOffers.length} Offers
                  </a>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {:else}
        <!-- Status Information for non-approved mediums -->
        <div class="card p-6">
          <h3 class="h3 mb-4">Status Information</h3>
          {#if mediumOfExchange.status === 'pending'}
            <div class="alert variant-soft-warning">
              <p class="font-semibold">Pending Review</p>
              <p>
                This medium of exchange is currently under review by administrators. Once approved,
                it will be available for use in requests and offers.
              </p>
            </div>
          {:else if mediumOfExchange.status === 'rejected'}
            <div class="alert variant-soft-error">
              <p class="font-semibold">Rejected</p>
              <p>
                This medium of exchange has been rejected by administrators and is not available for
                use.
              </p>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Information Section -->
      <div class="card p-6">
        <h3 class="h3 mb-4">About This Medium of Exchange</h3>
        <div class="text-surface-600 dark:text-surface-400 space-y-2">
          <p>
            <strong>{mediumOfExchange.code}</strong> ({mediumOfExchange.name})
            {#if mediumOfExchange.status === 'approved'}
              is an approved medium of exchange that can be used for compensation in requests and
              offers.
            {:else if mediumOfExchange.status === 'pending'}
              is currently being reviewed for approval as a medium of exchange.
            {:else}
              was suggested as a medium of exchange but has been rejected.
            {/if}
          </p>

          {#if mediumOfExchange.resourceSpecHreaId}
            <p>
              This medium is integrated with the hREA (Holochain Resource Exchange Architecture)
              system with Resource Specification ID: <code class="code"
                >{mediumOfExchange.resourceSpecHreaId}</code
              >
            </p>
          {/if}

          <p>
            When creating requests or offers, users can specify this medium to indicate their
            preferred form of compensation, helping to match compatible exchange partners.
          </p>
        </div>
      </div>
    </div>
  {:else}
    <div class="card p-8 text-center">
      <h2 class="h2 mb-4">Medium of Exchange Not Found</h2>
      <p class="text-surface-600 dark:text-surface-400 mb-4">
        The requested medium of exchange could not be found or may have been removed.
      </p>
      <button class="btn variant-filled-primary" onclick={() => goto('/mediums-of-exchange')}>
        Browse All Mediums
      </button>
    </div>
  {/if}
</section>
