<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import { storeEventBus } from '$lib/stores/storeEvents';
  import type { Proposal } from '$lib/types/hrea';
  import type { UIRequest, UIOffer } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import { encodeHashToBase64 } from '@holochain/client';

  let loading = $state(false);
  let error = $state<string | null>(null);
  let syncInfo = $state({
    requestsCount: 0,
    offersCount: 0,
    proposalsCount: 0,
    requestProposalsCount: 0,
    offerProposalsCount: 0,
    lastSyncEvent: 'None'
  });

  // Array to store unsubscribe functions for cleanup
  let unsubscribeFunctions: (() => void)[] = [];

  // Filter proposals by type based on mappings
  let requestProposals = $derived(
    hreaStore.proposals.filter((proposal) => {
      // Check if this proposal is referenced by any request
      return Array.from(hreaStore.requestProposalMappings.values()).includes(proposal.id);
    })
  );

  let offerProposals = $derived(
    hreaStore.proposals.filter((proposal) => {
      // Check if this proposal is referenced by any offer
      return Array.from(hreaStore.offerProposalMappings.values()).includes(proposal.id);
    })
  );

  // Reactive sync counters
  $effect(() => {
    syncInfo.requestsCount = requestsStore.requests.length;
    syncInfo.offersCount = offersStore.offers.length;
    syncInfo.proposalsCount = hreaStore.proposals.length;
    syncInfo.requestProposalsCount = requestProposals.length;
    syncInfo.offerProposalsCount = offerProposals.length;
  });

  function setupEventListeners() {
    // Listen for automatic proposal creation events
    const unsubscribeRequestCreated = storeEventBus.on('request:created', ({ request }) => {
      console.log('Request created, auto-creating proposal:', request.title);
      syncInfo.lastSyncEvent = `Auto-proposal from request: ${request.title}`;
    });

    const unsubscribeOfferCreated = storeEventBus.on('offer:created', ({ offer }) => {
      console.log('Offer created, auto-creating proposal:', offer.title);
      syncInfo.lastSyncEvent = `Auto-proposal from offer: ${offer.title}`;
    });

    unsubscribeFunctions.push(unsubscribeRequestCreated, unsubscribeOfferCreated);
  }

  async function loadHreaData() {
    try {
      loading = true;
      error = null;
      console.log('Loading hREA proposal data from DHT...');

      // Load all hREA proposals and intents from the DHT
      await runEffect(hreaStore.getAllProposals());
      await runEffect(hreaStore.getAllIntents());

      console.log('hREA proposal data loaded successfully');
      syncInfo.lastSyncEvent = 'Proposal DHT data loaded';
    } catch (err) {
      console.error('Error loading hREA proposal data:', err);
      error = err instanceof Error ? err.message : 'Failed to load hREA proposal data';
    } finally {
      loading = false;
    }
  }

  async function loadApplicationData() {
    try {
      console.log('Loading application requests and offers...');
      await runEffect(requestsStore.getActiveRequests());
      await runEffect(offersStore.getActiveOffers());
    } catch (err) {
      console.error('Error loading application data:', err);
    }
  }

  function extractActionHashFromNote(note: string, entityType: 'request' | 'offer'): string | null {
    const prefix = `ref:${entityType}:`;
    if (note.includes(prefix)) {
      // Look for the reference in the note
      const match = note.match(new RegExp(`${prefix}([^\\s]+)`));
      return match ? match[1] : null;
    }
    return null;
  }

  function findRequestByActionHash(actionHash: string): UIRequest | null {
    return (
      requestsStore.requests.find(
        (request: UIRequest) => request.original_action_hash?.toString() === actionHash
      ) || null
    );
  }

  function findOfferByActionHash(actionHash: string): UIOffer | null {
    return (
      offersStore.offers.find(
        (offer: UIOffer) => offer.original_action_hash?.toString() === actionHash
      ) || null
    );
  }

  function getProposalSourceEntity(proposal: Proposal): {
    type: 'request' | 'offer' | 'unknown';
    entity: UIRequest | UIOffer | null;
    actionHash: string | null;
  } {
    // Check if it's a request-based proposal
    for (const [requestHash, proposalId] of hreaStore.requestProposalMappings.entries()) {
      if (proposalId === proposal.id) {
        const request = findRequestByActionHash(requestHash);
        return { type: 'request', entity: request, actionHash: requestHash };
      }
    }

    // Check if it's an offer-based proposal
    for (const [offerHash, proposalId] of hreaStore.offerProposalMappings.entries()) {
      if (proposalId === proposal.id) {
        const offer = findOfferByActionHash(offerHash);
        return { type: 'offer', entity: offer, actionHash: offerHash };
      }
    }

    return { type: 'unknown', entity: null, actionHash: null };
  }

  async function navigateToSourceEntity(proposal: Proposal) {
    const source = getProposalSourceEntity(proposal);

    if (!source.entity || !source.actionHash) {
      console.warn('Source entity not found for proposal:', proposal.name);
      error = 'Associated request or offer not found';
      return;
    }

    try {
      // Convert action hash to base64 for navigation
      let navigationHash: string;
      if (source.actionHash.includes(',')) {
        // Convert comma-separated string back to Uint8Array, then to base64
        const uint8Array = new Uint8Array(
          source.actionHash.split(',').map((num) => parseInt(num, 10))
        );
        navigationHash = encodeHashToBase64(uint8Array);
      } else {
        // If it's already in base64 format, use as-is
        navigationHash = source.actionHash;
      }

      // Navigate to the appropriate detail page
      if (source.type === 'request') {
        goto(`/requests/${navigationHash}`);
      } else if (source.type === 'offer') {
        goto(`/offers/${navigationHash}`);
      }
    } catch (err) {
      console.error('Error processing action hash for navigation:', err);
      error = 'Failed to process action hash for navigation';
    }
  }

  function getProposalTypeLabel(proposal: Proposal): string {
    const source = getProposalSourceEntity(proposal);
    return source.type === 'request'
      ? 'Request-based'
      : source.type === 'offer'
        ? 'Offer-based'
        : 'Unknown';
  }

  function getProposalTypeBadgeClass(proposal: Proposal): string {
    const source = getProposalSourceEntity(proposal);
    return source.type === 'request'
      ? 'variant-soft-primary'
      : source.type === 'offer'
        ? 'variant-soft-secondary'
        : 'variant-soft-surface';
  }

  onMount(async () => {
    console.log('ProposalManager mounted');
    console.log('hreaStore proposal state:', {
      proposals: hreaStore.proposals,
      requestProposalMappings: hreaStore.requestProposalMappings,
      offerProposalMappings: hreaStore.offerProposalMappings,
      loading: hreaStore.loading,
      error: hreaStore.error
    });

    // Setup event listeners for automatic syncing
    setupEventListeners();

    // Load initial data
    await loadHreaData();
    await loadApplicationData();
  });

  onDestroy(() => {
    // Clean up event listeners
    unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
  });
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-2">
    <button
      class="variant-soft-surface btn btn-sm"
      onclick={async () => {
        await loadHreaData();
        await loadApplicationData();
      }}
      disabled={loading || hreaStore.loading}
    >
      <i class="fa-solid fa-refresh"></i>
      <span>Refresh</span>
    </button>
  </div>

  <!-- Sync Status Card -->
  <div class="card bg-surface-100-800-token p-4">
    <h3 class="mb-3 text-lg font-semibold">Request/Offer → hREA Proposal Status</h3>
    <div class="grid grid-cols-2 gap-4 text-center md:grid-cols-5">
      <div class="space-y-1">
        <div class="text-2xl font-bold text-primary-500">{syncInfo.requestsCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Total Requests</div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-secondary-500">{syncInfo.offersCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Total Offers</div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-tertiary-500">{syncInfo.proposalsCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Total hREA Proposals</div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-primary-400">{syncInfo.requestProposalsCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Request-based Proposals</div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-secondary-400">{syncInfo.offerProposalsCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Offer-based Proposals</div>
      </div>
    </div>

    <div class="bg-surface-200-700-token mt-4 rounded p-2 text-sm">
      <strong>Last Auto Event:</strong>
      {syncInfo.lastSyncEvent}
    </div>
    <div class="mt-2 text-xs text-surface-500">
      <i class="fa-solid fa-info-circle mr-1"></i>
      Note: Proposals are created automatically when requests and offers are submitted. Each proposal
      contains multiple intents following the two-intent reciprocal pattern.
    </div>
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="alert variant-filled-error">
      <i class="fa-solid fa-exclamation-triangle"></i>
      <span>{error}</span>
      <button
        class="btn-icon btn-icon-sm"
        onclick={() => (error = null)}
        aria-label="Close error message"
      >
        <i class="fa-solid fa-close"></i>
      </button>
    </div>
  {/if}

  <!-- hREA Store Status -->
  {#if hreaStore.error}
    <div class="alert variant-filled-error">
      <i class="fa-solid fa-exclamation-triangle"></i>
      <span>hREA Store Error: {hreaStore.error}</span>
    </div>
  {/if}

  <!-- Proposals Content -->
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">
        hREA Proposals ({hreaStore.proposals.length})
      </h3>
      <div class="text-sm text-surface-500">
        Click on a proposal to view its source request or offer
      </div>
    </div>

    {#if loading || hreaStore.loading}
      <div class="flex items-center justify-center p-8">
        <i class="fa-solid fa-spinner animate-spin text-2xl text-primary-500"></i>
        <span class="ml-2">Loading proposals...</span>
      </div>
    {:else if hreaStore.proposals.length === 0}
      <div class="card p-8 text-center text-surface-500">
        <i class="fa-solid fa-handshake mb-4 text-4xl"></i>
        <p>No proposals found in hREA DHT</p>
        <p class="mt-2 text-sm">
          Proposals will be created automatically when requests and offers are submitted
        </p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {#each hreaStore.proposals as proposal}
          {@const source = getProposalSourceEntity(proposal)}
          <div
            class="card cursor-pointer space-y-3 p-4 transition-colors hover:bg-surface-100-800-token"
            onclick={() => navigateToSourceEntity(proposal)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateToSourceEntity(proposal);
              }
            }}
          >
            <!-- Header with name and type -->
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <h4 class="font-semibold text-primary-600 dark:text-primary-400">
                  {proposal.name}
                </h4>
                <div class="mt-1 flex items-center gap-2">
                  <span class="badge text-xs {getProposalTypeBadgeClass(proposal)}">
                    {getProposalTypeLabel(proposal)}
                  </span>
                  {#if source.entity}
                    <span class="variant-soft-success badge text-xs">
                      <i class="fa-solid fa-check mr-1"></i>
                      Source Found
                    </span>
                  {:else}
                    <span class="variant-soft-warning badge text-xs">
                      <i class="fa-solid fa-exclamation mr-1"></i>
                      Source Missing
                    </span>
                  {/if}
                </div>
              </div>
              <i class="fa-solid fa-external-link ml-2 mt-1 text-sm text-surface-400"></i>
            </div>

            <!-- Source Entity Information -->
            {#if source.entity}
              <div class="bg-surface-100-800-token rounded p-2 text-sm">
                <div class="font-medium text-surface-700 dark:text-surface-300">
                  Source {source.type === 'request' ? 'Request' : 'Offer'}:
                </div>
                <div class="text-surface-600 dark:text-surface-400">
                  {source.entity.title}
                </div>
                {#if source.entity.description}
                  <div class="mt-1 line-clamp-2 text-xs text-surface-500">
                    {source.entity.description}
                  </div>
                {/if}
              </div>
            {:else if source.actionHash}
              <div class="rounded bg-warning-500/10 p-2 text-sm">
                <div class="text-warning-700 dark:text-warning-300">
                  Source {source.type} not found
                </div>
                <div class="text-xs text-warning-600 dark:text-warning-400">
                  Hash: {source.actionHash.slice(-12)}
                </div>
              </div>
            {/if}

            <!-- Proposal Details -->
            {#if proposal.note}
              <div class="text-sm text-surface-600 dark:text-surface-400">
                <div class="line-clamp-3">
                  {proposal.note}
                </div>
              </div>
            {/if}

            <!-- Eligible Agents -->
            {#if proposal.eligible && proposal.eligible.length > 0}
              <div class="flex flex-wrap gap-1">
                <span class="variant-soft-tertiary badge text-xs">
                  Eligible: {proposal.eligible.length} agent{proposal.eligible.length !== 1
                    ? 's'
                    : ''}
                </span>
              </div>
            {/if}

            <!-- Footer with hREA ID and creation date -->
            <div
              class="border-surface-200-700-token flex items-center justify-between border-t pt-2 text-xs text-surface-500"
            >
              <span>hREA ID: {proposal.id.slice(-8)}</span>
              <div class="flex items-center gap-2">
                {#if proposal.created}
                  <span>{new Date(proposal.created).toLocaleDateString()}</span>
                {/if}
                <span class="text-primary-500">
                  <i class="fa-solid fa-arrow-right"></i>
                  View Source
                </span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Proposal Type Breakdown -->
  {#if hreaStore.proposals.length > 0}
    <div class="card bg-surface-50-900-token p-4">
      <h3 class="mb-3 text-lg font-semibold">Proposal Type Breakdown</h3>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <!-- Request-based Proposals -->
        <div class="rounded bg-primary-500/10 p-3">
          <h4 class="font-semibold text-primary-500">Request-based Proposals</h4>
          <div class="space-y-1 text-sm">
            <div>Count: {requestProposals.length}</div>
            <div class="text-xs text-surface-500">
              Created when users submit requests for services
            </div>
          </div>
        </div>

        <!-- Offer-based Proposals -->
        <div class="rounded bg-secondary-500/10 p-3">
          <h4 class="font-semibold text-secondary-500">Offer-based Proposals</h4>
          <div class="space-y-1 text-sm">
            <div>Count: {offerProposals.length}</div>
            <div class="text-xs text-surface-500">
              Created when users submit offers to provide services
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
