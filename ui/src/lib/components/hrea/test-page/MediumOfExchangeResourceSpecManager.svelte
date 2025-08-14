<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { storeEventBus } from '$lib/stores/storeEvents';
  import type { ResourceSpecification } from '$lib/types/hrea';
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
  import { runEffect } from '@/lib/utils/effect';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';

  let loading = $state(false);
  let syncLoading = $state(false);
  let error = $state<string | null>(null);
  let syncInfo = $state({
    mediumsOfExchangeCount: 0,
    resourceSpecsCount: 0,
    lastSyncEvent: 'None',
    lastManualSync: 'None'
  });

  // Manual sync status
  let syncResults = $state({
    mediumsOfExchange: { synced: 0, created: 0, updated: 0, errors: 0 }
  });

  // Array to store unsubscribe functions for cleanup
  let unsubscribeFunctions: (() => void)[] = [];

  // Filter resource specs that are medium of exchange related
  let mediumOfExchangeResourceSpecs = $derived(
    hreaStore.resourceSpecifications.filter((spec) =>
      spec.note?.startsWith('ref:mediumOfExchange:')
    )
  );

  // Reactive sync counters
  $effect(() => {
    syncInfo.mediumsOfExchangeCount = mediumsOfExchangeStore.approvedMediumsOfExchange.length;
    syncInfo.resourceSpecsCount = hreaStore.resourceSpecifications.length;
  });

  function setupEventListeners() {
    console.log('Setting up medium of exchange event listeners');

    // Listen to medium of exchange events
    const unsubscribeMediumOfExchangeApproved = storeEventBus.on(
      'mediumOfExchange:approved',
      () => {
        syncInfo.lastSyncEvent = 'Medium of Exchange approved';
        // Optionally reload hREA data to see the new resource specification
        loadHreaData();
      }
    );

    const unsubscribeMediumOfExchangeRejected = storeEventBus.on(
      'mediumOfExchange:rejected',
      () => {
        syncInfo.lastSyncEvent = 'Medium of Exchange rejected';
        // Optionally reload hREA data to see updated state
        loadHreaData();
      }
    );

    const unsubscribeMediumOfExchangeDeleted = storeEventBus.on('mediumOfExchange:deleted', () => {
      syncInfo.lastSyncEvent = 'Medium of Exchange deleted';
      // Optionally reload hREA data to see updated state
      loadHreaData();
    });

    unsubscribeFunctions.push(
      unsubscribeMediumOfExchangeApproved,
      unsubscribeMediumOfExchangeRejected,
      unsubscribeMediumOfExchangeDeleted
    );
  }

  async function loadHreaData() {
    try {
      loading = true;
      error = null;
      console.log('Loading hREA data from DHT...');

      // Load all hREA entities from the DHT
      await runEffect(hreaStore.getAllAgents());
      await runEffect(hreaStore.getAllResourceSpecifications());

      console.log('hREA data loaded successfully');
      syncInfo.lastSyncEvent = 'DHT data loaded';
    } catch (err) {
      console.error('Error loading hREA data:', err);
      error = err instanceof Error ? err.message : 'Failed to load hREA data';
    } finally {
      loading = false;
    }
  }

  async function loadMediumsOfExchange() {
    try {
      console.log('Loading approved mediums of exchange for sync info...');
      await runEffect(mediumsOfExchangeStore.getApprovedMediumsOfExchange());
    } catch (err) {
      console.error('Error loading mediums of exchange:', err);
    }
  }

  async function manualSyncMediumsOfExchange() {
    try {
      syncLoading = true;
      const results = { synced: 0, created: 0, updated: 0, errors: 0 };

      console.log('Starting manual medium of exchange sync...');

      for (const moe of mediumsOfExchangeStore.approvedMediumsOfExchange) {
        try {
          const moeHash = moe.actionHash?.toString();
          if (!moeHash) continue;

          // Check if resource spec already exists
          const existingResourceSpec = hreaStore.findResourceSpecByActionHash(moeHash);

          if (existingResourceSpec) {
            console.log(`Resource spec already exists for medium: ${moe.code}`);
            results.updated++;
          } else {
            // Create resource specification for this medium of exchange
            console.log(`Creating resource spec for medium: ${moe.code}`);
            await runEffect(hreaStore.syncMediumOfExchangeToResourceSpec(moe));
            results.created++;
          }

          results.synced++;
        } catch (err) {
          console.error(`Error syncing medium of exchange ${moe.code}:`, err);
          results.errors++;
        }
      }

      syncResults.mediumsOfExchange = results;
      syncInfo.lastManualSync = `MediumsOfExchange: ${results.synced} synced, ${results.created} created, ${results.updated} updated, ${results.errors} errors`;

      // Reload resource specifications to reflect changes
      await runEffect(hreaStore.getAllResourceSpecifications());
    } catch (err) {
      console.error('Error in manual medium of exchange sync:', err);
      error = err instanceof Error ? err.message : 'Failed to sync mediums of exchange';
    } finally {
      syncLoading = false;
    }
  }

  function extractActionHashFromNote(
    note: string,
    entityType: 'user' | 'organization' | 'serviceType' | 'mediumOfExchange'
  ): string | null {
    const prefix = `ref:${entityType}:`;
    if (note.startsWith(prefix)) {
      return note.substring(prefix.length);
    }
    return null;
  }

  function findMediumOfExchangeByActionHash(actionHash: string): UIMediumOfExchange | null {
    return (
      mediumsOfExchangeStore.approvedMediumsOfExchange.find(
        (moe) => moe.actionHash?.toString() === actionHash
      ) || null
    );
  }

  function findResourceSpecByActionHash(
    actionHash: string,
    entityType: string
  ): ResourceSpecification | null {
    return (
      hreaStore.resourceSpecifications.find((spec) => {
        if (!spec.note) return false;
        const extractedHash = extractActionHashFromNote(spec.note, entityType as any);
        return extractedHash === actionHash;
      }) || null
    );
  }

  async function navigateToMediumOfExchange(resourceSpec: ResourceSpecification) {
    if (!resourceSpec.note?.startsWith('ref:mediumOfExchange:')) {
      console.warn('Resource specification does not have a medium of exchange reference');
      return;
    }

    const actionHash = extractActionHashFromNote(resourceSpec.note, 'mediumOfExchange');

    if (!actionHash) {
      console.warn('Could not extract action hash from note');
      return;
    }

    const mediumOfExchange = findMediumOfExchangeByActionHash(actionHash);
    if (!mediumOfExchange) {
      console.warn('Medium of exchange not found for action hash:', actionHash);
      error = 'Associated medium of exchange not found';
      return;
    }

    // The action hash from the note is in comma-separated format (Uint8Array.toString())
    // We need to convert it to base64 for navigation
    let navigationHash: string;
    try {
      if (actionHash.includes(',')) {
        // Convert comma-separated string back to Uint8Array, then to base64
        const uint8Array = new Uint8Array(actionHash.split(',').map((num) => parseInt(num, 10)));
        navigationHash = encodeHashToBase64(uint8Array);
      } else {
        // If it's already in base64 format, use as-is
        navigationHash = actionHash;
      }
    } catch (err) {
      console.error('Error processing action hash for navigation:', err);
      error = 'Failed to process action hash for navigation';
      return;
    }

    // Navigate to admin medium of exchange page
    goto(`/admin/mediums-of-exchange`);
  }

  onMount(async () => {
    console.log('MediumOfExchangeResourceSpecManager mounted');

    // Setup event listeners for automatic syncing
    setupEventListeners();

    // Load initial data
    await loadHreaData();
    await loadMediumsOfExchange();
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
        await loadMediumsOfExchange();
      }}
      disabled={loading || hreaStore.loading || syncLoading}
    >
      <i class="fa-solid fa-refresh"></i>
      <span>Refresh</span>
    </button>
    <button
      class="variant-filled-primary btn btn-sm"
      onclick={manualSyncMediumsOfExchange}
      disabled={loading || hreaStore.loading || syncLoading}
    >
      <i class="fa-solid fa-sync"></i>
      <span>Manual Sync</span>
    </button>
  </div>

  <!-- Sync Status Card -->
  <div class="card bg-surface-100-800-token p-4">
    <h3 class="mb-3 text-lg font-semibold">Medium of Exchange → hREA Synchronization Status</h3>
    <div class="grid grid-cols-2 gap-4 text-center md:grid-cols-3">
      <div class="space-y-1">
        <div class="text-2xl font-bold text-primary-500">{syncInfo.mediumsOfExchangeCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">
          Approved Mediums of Exchange
        </div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-secondary-500">
          {mediumOfExchangeResourceSpecs.length}
        </div>
        <div class="text-sm text-surface-600 dark:text-surface-400">hREA Resource Specs (MoE)</div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-tertiary-500">{syncInfo.resourceSpecsCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Total hREA Resource Specs</div>
      </div>
    </div>

    <div class="bg-surface-200-700-token mt-4 rounded p-2 text-sm">
      <strong>Last Auto Event:</strong>
      {syncInfo.lastSyncEvent}
    </div>
    <div class="bg-surface-200-700-token mt-2 rounded p-2 text-sm">
      <strong>Last Manual Sync:</strong>
      {syncInfo.lastManualSync}
    </div>
    <div class="mt-2 text-xs text-surface-500">
      <i class="fa-solid fa-info-circle mr-1"></i>
      Note: Full hREA sync functionality is a placeholder. This demonstrates the UI concept for Medium
      of Exchange resource specifications.
    </div>
  </div>

  <!-- Manual Sync Results -->
  {#if syncResults.mediumsOfExchange.synced > 0}
    <div class="card bg-surface-50-900-token p-4">
      <h3 class="mb-3 text-lg font-semibold">Manual Sync Results</h3>
      <div class="rounded bg-primary-500/10 p-3">
        <h4 class="font-semibold text-primary-500">Mediums of Exchange</h4>
        <div class="space-y-1 text-sm">
          <div>Synced: {syncResults.mediumsOfExchange.synced}</div>
          <div>Created: {syncResults.mediumsOfExchange.created}</div>
          <div>Updated: {syncResults.mediumsOfExchange.updated}</div>
          {#if syncResults.mediumsOfExchange.errors > 0}
            <div class="text-error-500">Errors: {syncResults.mediumsOfExchange.errors}</div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

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

  <!-- Medium of Exchange Resource Specifications Content -->
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">
        Medium of Exchange Resource Specifications ({mediumOfExchangeResourceSpecs.length})
      </h3>
      <div class="text-sm text-surface-500">
        Click on a resource specification to view its associated medium of exchange
      </div>
    </div>

    {#if loading || hreaStore.loading}
      <div class="flex items-center justify-center p-8">
        <i class="fa-solid fa-spinner animate-spin text-2xl text-primary-500"></i>
        <span class="ml-2">Loading resource specifications...</span>
      </div>
    {:else if mediumOfExchangeResourceSpecs.length === 0}
      <div class="card p-8 text-center text-surface-500">
        <i class="fa-solid fa-coins mb-4 text-4xl"></i>
        <p>No medium of exchange resource specifications found in hREA DHT</p>
        <p class="mt-2 text-sm">
          Resource specifications will be created when mediums of exchange are approved or via
          manual sync
        </p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each mediumOfExchangeResourceSpecs as spec}
          <div
            class="card cursor-pointer space-y-3 p-4 transition-colors hover:bg-surface-100-800-token"
            onclick={() => navigateToMediumOfExchange(spec)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateToMediumOfExchange(spec);
              }
            }}
          >
            <!-- Header with name and link indicator -->
            <div class="flex items-start justify-between">
              <h4 class="flex-1 font-semibold text-primary-600 dark:text-primary-400">
                {spec.name}
              </h4>
              <i class="fa-solid fa-external-link ml-2 mt-1 text-sm text-surface-400"></i>
            </div>

            <!-- Action Hash Reference -->
            {#if spec.note?.startsWith('ref:mediumOfExchange:')}
              {@const actionHash = extractActionHashFromNote(spec.note, 'mediumOfExchange')}
              {@const mediumOfExchange = actionHash
                ? findMediumOfExchangeByActionHash(actionHash)
                : null}

              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="variant-soft-primary badge text-xs">
                    Medium of Exchange Reference
                  </span>
                  {#if mediumOfExchange}
                    <span class="variant-soft-success badge text-xs">
                      <i class="fa-solid fa-check mr-1"></i>
                      Found
                    </span>
                  {:else}
                    <span class="variant-soft-warning badge text-xs">
                      <i class="fa-solid fa-exclamation mr-1"></i>
                      Not Found
                    </span>
                  {/if}
                </div>

                {#if mediumOfExchange}
                  <div class="bg-surface-100-800-token rounded p-2 text-sm">
                    <div class="font-medium text-surface-700 dark:text-surface-300">
                      Associated Medium of Exchange:
                    </div>
                    <div class="text-surface-600 dark:text-surface-400">
                      {mediumOfExchange.code} - {mediumOfExchange.name}
                    </div>
                    <div class="mt-1 text-xs text-surface-500">
                      Status: {mediumOfExchange.status}
                    </div>
                  </div>
                {:else}
                  <div class="rounded bg-warning-500/10 p-2 text-sm">
                    <div class="text-warning-700 dark:text-warning-300">
                      Associated medium of exchange not found
                    </div>
                    <div class="text-xs text-warning-600 dark:text-warning-400">
                      Hash: {actionHash?.slice(-12) || 'Unknown'}
                    </div>
                  </div>
                {/if}
              </div>
            {:else if spec.note}
              <div class="text-sm text-surface-600 dark:text-surface-400">
                {spec.note}
              </div>
            {/if}

            <!-- Classification tags -->
            {#if spec.classifiedAs && spec.classifiedAs.length > 0}
              <div class="flex flex-wrap gap-1">
                {#each spec.classifiedAs as classification}
                  <span class="variant-soft-secondary badge text-xs">
                    {classification.split('/').pop()}
                  </span>
                {/each}
              </div>
            {/if}

            <!-- Footer with hREA ID -->
            <div
              class="border-surface-200-700-token flex items-center justify-between border-t pt-2 text-xs text-surface-500"
            >
              <span>hREA ID: {spec.id.slice(-8)}</span>
              <span class="text-primary-500">
                <i class="fa-solid fa-arrow-right"></i>
                View Details
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
