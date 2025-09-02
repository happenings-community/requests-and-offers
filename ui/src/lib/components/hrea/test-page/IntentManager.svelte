<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import { storeEventBus } from '$lib/stores/storeEvents';
  import type { Intent, Agent, ResourceSpecification } from '$lib/types/hrea';
  import { runEffect } from '$lib/utils/effect';

  let loading = $state(false);
  let error = $state<string | null>(null);
  let syncInfo = $state({
    intentsCount: 0,
    serviceIntentsCount: 0,
    paymentIntentsCount: 0,
    linkedIntentsCount: 0,
    unlinkedIntentsCount: 0,
    lastSyncEvent: 'None'
  });

  // Array to store unsubscribe functions for cleanup
  let unsubscribeFunctions: (() => void)[] = [];

  // Filter intents by action type
  let serviceIntents = $derived(hreaStore.intents.filter((_intent) => _intent.action === 'work'));

  let paymentIntents = $derived(
    hreaStore.intents.filter((_intent) => _intent.action === 'transfer')
  );

  // Get intents that are linked to proposals vs unlinked
  let linkedIntents = $derived(
    hreaStore.intents.filter((_intent) => {
      // Check if this intent is referenced by any proposal
      // In a real implementation, we'd need to track proposal-intent relationships
      // For now, we'll assume all intents created through our system are linked
      return true;
    })
  );

  let unlinkedIntents = $derived(
    hreaStore.intents.filter((_intent) => {
      // Placeholder logic - in practice we'd track the relationship
      return false;
    })
  );

  // Reactive sync counters
  $effect(() => {
    syncInfo.intentsCount = hreaStore.intents.length;
    syncInfo.serviceIntentsCount = serviceIntents.length;
    syncInfo.paymentIntentsCount = paymentIntents.length;
    syncInfo.linkedIntentsCount = linkedIntents.length;
    syncInfo.unlinkedIntentsCount = unlinkedIntents.length;
  });

  function setupEventListeners() {
    // Listen for automatic intent creation events
    const unsubscribeRequestCreated = storeEventBus.on('request:created', ({ request }) => {
      console.log('Request created, auto-creating intents:', request.title);
      syncInfo.lastSyncEvent = `Auto-intents from request: ${request.title}`;
    });

    const unsubscribeOfferCreated = storeEventBus.on('offer:created', ({ offer }) => {
      console.log('Offer created, auto-creating intents:', offer.title);
      syncInfo.lastSyncEvent = `Auto-intents from offer: ${offer.title}`;
    });

    unsubscribeFunctions.push(unsubscribeRequestCreated, unsubscribeOfferCreated);
  }

  async function loadHreaData() {
    try {
      loading = true;
      error = null;
      console.log('Loading hREA intent data from DHT...');

      // Load all hREA intents and related data from the DHT
      await runEffect(hreaStore.getAllIntents());
      await runEffect(hreaStore.getAllProposals());
      await runEffect(hreaStore.getAllAgents());
      await runEffect(hreaStore.getAllResourceSpecifications());

      console.log('hREA intent data loaded successfully');
      syncInfo.lastSyncEvent = 'Intent DHT data loaded';
    } catch (err) {
      console.error('Error loading hREA intent data:', err);
      error = err instanceof Error ? err.message : 'Failed to load hREA intent data';
    } finally {
      loading = false;
    }
  }

  function findAgentById(agentId: string): Agent | null {
    return hreaStore.agents.find((agent) => agent.id === agentId) || null;
  }

  function findResourceSpecById(resourceSpecId: string): ResourceSpecification | null {
    return hreaStore.resourceSpecifications.find((spec) => spec.id === resourceSpecId) || null;
  }

  function getIntentActionLabel(action: string): string {
    switch (action) {
      case 'work':
        return 'Service Provision';
      case 'transfer':
        return 'Payment/Transfer';
      case 'consume':
        return 'Consumption';
      case 'produce':
        return 'Production';
      case 'use':
        return 'Usage';
      default:
        return action.charAt(0).toUpperCase() + action.slice(1);
    }
  }

  function getIntentActionIcon(action: string): string {
    switch (action) {
      case 'work':
        return 'fa-solid fa-wrench';
      case 'transfer':
        return 'fa-solid fa-exchange-alt';
      case 'consume':
        return 'fa-solid fa-utensils';
      case 'produce':
        return 'fa-solid fa-industry';
      case 'use':
        return 'fa-solid fa-hand-point-right';
      default:
        return 'fa-solid fa-bullseye';
    }
  }

  function getIntentActionBadgeClass(action: string): string {
    switch (action) {
      case 'work':
        return 'variant-soft-primary';
      case 'transfer':
        return 'variant-soft-secondary';
      case 'consume':
        return 'variant-soft-warning';
      case 'produce':
        return 'variant-soft-success';
      case 'use':
        return 'variant-soft-tertiary';
      default:
        return 'variant-soft-surface';
    }
  }

  function getIntentRoleLabel(intent: Intent): string {
    if (intent.provider && intent.receiver) {
      return 'Provider & Receiver';
    } else if (intent.provider) {
      return 'Provider';
    } else if (intent.receiver) {
      return 'Receiver';
    }
    return 'No Role Specified';
  }

  function getResourceSpecTypeFromNote(
    resourceSpec: ResourceSpecification | null
  ): 'service' | 'currency' | 'unknown' {
    if (!resourceSpec?.note) return 'unknown';
    if (resourceSpec.note.startsWith('ref:serviceType:')) return 'service';
    if (resourceSpec.note.startsWith('ref:mediumOfExchange:')) return 'currency';
    return 'unknown';
  }

  onMount(async () => {
    console.log('IntentManager mounted');
    console.log('hreaStore intent state:', {
      intents: hreaStore.intents,
      proposals: hreaStore.proposals,
      agents: hreaStore.agents,
      resourceSpecifications: hreaStore.resourceSpecifications,
      loading: hreaStore.loading,
      error: hreaStore.error
    });

    // Setup event listeners for automatic syncing
    setupEventListeners();

    // Load initial data
    await loadHreaData();
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
      }}
      disabled={loading || hreaStore.loading}
    >
      <i class="fa-solid fa-refresh"></i>
      <span>Refresh</span>
    </button>
  </div>

  <!-- Sync Status Card -->
  <div class="card bg-surface-100-800-token p-4">
    <h3 class="mb-3 text-lg font-semibold">hREA Intent Analytics</h3>
    <div class="grid grid-cols-2 gap-4 text-center md:grid-cols-5">
      <div class="space-y-1">
        <div class="text-2xl font-bold text-primary-500">{syncInfo.intentsCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Total Intents</div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-secondary-500">{syncInfo.serviceIntentsCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Service Intents</div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-tertiary-500">{syncInfo.paymentIntentsCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Payment Intents</div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-success-500">{syncInfo.linkedIntentsCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Linked to Proposals</div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-warning-500">{syncInfo.unlinkedIntentsCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Unlinked Intents</div>
      </div>
    </div>

    <div class="bg-surface-200-700-token mt-4 rounded p-2 text-sm">
      <strong>Last Auto Event:</strong>
      {syncInfo.lastSyncEvent}
    </div>
    <div class="mt-2 text-xs text-surface-500">
      <i class="fa-solid fa-info-circle mr-1"></i>
      Note: Intents are created automatically as part of proposals following the two-intent reciprocal
      pattern. Service intents represent work to be done, payment intents represent compensation.
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

  <!-- Intents Content -->
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">
        hREA Intents ({hreaStore.intents.length})
      </h3>
      <div class="text-sm text-surface-500">
        Explore individual economic intents created from proposals
      </div>
    </div>

    {#if loading || hreaStore.loading}
      <div class="flex items-center justify-center p-8">
        <i class="fa-solid fa-spinner animate-spin text-2xl text-primary-500"></i>
        <span class="ml-2">Loading intents...</span>
      </div>
    {:else if hreaStore.intents.length === 0}
      <div class="card p-8 text-center text-surface-500">
        <i class="fa-solid fa-bullseye mb-4 text-4xl"></i>
        <p>No intents found in hREA DHT</p>
        <p class="mt-2 text-sm">
          Intents will be created automatically when proposals are generated from requests and
          offers
        </p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {#each hreaStore.intents as intent}
          {@const provider = intent.provider ? findAgentById(intent.provider) : null}
          {@const receiver = intent.receiver ? findAgentById(intent.receiver) : null}
          {@const resourceSpec = intent.resourceSpecifiedBy
            ? findResourceSpecById(intent.resourceSpecifiedBy)
            : null}
          {@const resourceType = getResourceSpecTypeFromNote(resourceSpec)}

          <div class="card space-y-3 p-4">
            <!-- Header with action type -->
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <i class="{getIntentActionIcon(intent.action)} text-lg"></i>
                  <h4 class="font-semibold text-surface-700 dark:text-surface-300">
                    {getIntentActionLabel(intent.action)}
                  </h4>
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <span class="badge text-xs {getIntentActionBadgeClass(intent.action)}">
                    {intent.action}
                  </span>
                  {#if resourceType !== 'unknown'}
                    <span
                      class="badge text-xs {resourceType === 'service'
                        ? 'variant-soft-primary'
                        : 'variant-soft-secondary'}"
                    >
                      {resourceType === 'service' ? 'Service' : 'Currency'}
                    </span>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Resource Specification -->
            {#if resourceSpec}
              <div class="bg-surface-100-800-token rounded p-2 text-sm">
                <div class="font-medium text-surface-700 dark:text-surface-300">Resource:</div>
                <div class="text-surface-600 dark:text-surface-400">
                  {resourceSpec.name}
                </div>
                {#if resourceSpec.note}
                  <div class="mt-1 text-xs text-surface-500">
                    {resourceSpec.note.startsWith('ref:')
                      ? 'Linked to application entity'
                      : resourceSpec.note}
                  </div>
                {/if}
              </div>
            {:else if intent.resourceSpecifiedBy}
              <div class="rounded bg-warning-500/10 p-2 text-sm">
                <div class="text-warning-700 dark:text-warning-300">
                  Resource specification not found
                </div>
                <div class="text-xs text-warning-600 dark:text-warning-400">
                  ID: {intent.resourceSpecifiedBy.slice(-8)}
                </div>
              </div>
            {/if}

            <!-- Agent Roles -->
            <div class="space-y-2">
              <div class="text-sm font-medium text-surface-700 dark:text-surface-300">
                {getIntentRoleLabel(intent)}
              </div>

              {#if provider}
                <div class="flex items-center gap-2 text-sm">
                  <i class="fa-solid fa-user-plus text-success-500"></i>
                  <span class="text-surface-600 dark:text-surface-400">Provider:</span>
                  <span class="font-medium text-surface-700 dark:text-surface-300"
                    >{provider.name}</span
                  >
                </div>
              {/if}

              {#if receiver}
                <div class="flex items-center gap-2 text-sm">
                  <i class="fa-solid fa-user-check text-primary-500"></i>
                  <span class="text-surface-600 dark:text-surface-400">Receiver:</span>
                  <span class="font-medium text-surface-700 dark:text-surface-300"
                    >{receiver.name}</span
                  >
                </div>
              {/if}
            </div>

            <!-- Resource Quantity -->
            {#if intent.resourceQuantity}
              <div class="rounded bg-tertiary-500/10 p-2 text-sm">
                <div class="text-tertiary-700 dark:text-tertiary-300">
                  Quantity: {intent.resourceQuantity.hasNumericalValue}
                  {intent.resourceQuantity.hasUnit || 'units'}
                </div>
              </div>
            {/if}

            <!-- Footer with hREA ID -->
            <div
              class="border-surface-200-700-token flex items-center justify-between border-t pt-2 text-xs text-surface-500"
            >
              <span>hREA ID: {intent.id.slice(-8)}</span>
              <span class="flex items-center gap-1">
                <i class="fa-solid fa-link"></i>
                Linked Intent
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Intent Type Analysis -->
  {#if hreaStore.intents.length > 0}
    <div class="card bg-surface-50-900-token p-4">
      <h3 class="mb-3 text-lg font-semibold">Intent Analysis</h3>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <!-- Service Intents -->
        <div class="rounded bg-primary-500/10 p-3">
          <h4 class="flex items-center gap-2 font-semibold text-primary-500">
            <i class="fa-solid fa-wrench"></i>
            Service Intents (work)
          </h4>
          <div class="space-y-1 text-sm">
            <div>Count: {serviceIntents.length}</div>
            <div class="text-xs text-surface-500">Represent services or work to be performed</div>
          </div>
        </div>

        <!-- Payment Intents -->
        <div class="rounded bg-secondary-500/10 p-3">
          <h4 class="flex items-center gap-2 font-semibold text-secondary-500">
            <i class="fa-solid fa-exchange-alt"></i>
            Payment Intents (transfer)
          </h4>
          <div class="space-y-1 text-sm">
            <div>Count: {paymentIntents.length}</div>
            <div class="text-xs text-surface-500">Represent payments or value transfers</div>
          </div>
        </div>
      </div>

      <!-- Two-Intent Pattern Explanation -->
      <div class="mt-4 rounded bg-tertiary-500/10 p-3">
        <h4 class="flex items-center gap-2 font-semibold text-tertiary-500">
          <i class="fa-solid fa-arrows-rotate"></i>
          Two-Intent Reciprocal Pattern
        </h4>
        <div class="mt-2 text-sm text-surface-600 dark:text-surface-400">
          Each proposal contains both service and payment intents to model complete economic
          exchange:
          <ul class="mt-2 list-inside list-disc space-y-1 text-xs">
            <li><strong>Service Intent:</strong> Someone provides work/service</li>
            <li><strong>Payment Intent:</strong> Someone provides compensation</li>
            <li><strong>Reciprocity:</strong> Both parties give and receive value</li>
          </ul>
        </div>
      </div>
    </div>
  {/if}
</div>
