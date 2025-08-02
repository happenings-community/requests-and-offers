<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { storeEventBus } from '$lib/stores/storeEvents';
  import type { ResourceSpecification } from '$lib/types/hrea';
  import type { UIServiceType } from '$lib/types/ui';
  import { runEffect } from '@/lib/utils/effect';
  import { encodeHashToBase64 } from '@holochain/client';

  let loading = $state(false);
  let syncLoading = $state(false);
  let error = $state<string | null>(null);
  let syncInfo = $state({
    serviceTypesCount: 0,
    resourceSpecsCount: 0,
    usersCount: 0,
    agentsCount: 0,
    lastSyncEvent: 'None',
    lastManualSync: 'None'
  });

  // Manual sync status
  let syncResults = $state({
    users: { synced: 0, created: 0, updated: 0, errors: 0 },
    organizations: { synced: 0, created: 0, updated: 0, errors: 0 },
    serviceTypes: { synced: 0, created: 0, updated: 0, errors: 0 }
  });

  // Array to store unsubscribe functions for cleanup
  let unsubscribeFunctions: (() => void)[] = [];

  // Filter resource specs that are service type related
  let serviceTypeResourceSpecs = $derived(
    hreaStore.resourceSpecifications.filter((spec) => spec.note?.startsWith('ref:serviceType:'))
  );

  // Reactive sync counters
  $effect(() => {
    syncInfo.serviceTypesCount = serviceTypesStore.approvedServiceTypes.length;
    syncInfo.resourceSpecsCount = hreaStore.resourceSpecifications.length;
    syncInfo.agentsCount = hreaStore.agents.length;
  });

  function setupEventListeners() {
    // Listen for automatic sync events to show UI status updates
    const unsubscribeApproved = storeEventBus.on('serviceType:approved', ({ serviceType }) => {
      console.log(
        'Service type approved, hREA auto-creating resource specification:',
        serviceType.name
      );
      syncInfo.lastSyncEvent = `Auto-approved: ${serviceType.name}`;
    });

    const unsubscribeRejected = storeEventBus.on('serviceType:rejected', ({ serviceType }) => {
      console.log(
        'Service type rejected, hREA auto-removing resource specification:',
        serviceType.name
      );
      syncInfo.lastSyncEvent = `Auto-rejected: ${serviceType.name}`;
    });

    const unsubscribeDeleted = storeEventBus.on('serviceType:deleted', ({ serviceTypeHash }) => {
      console.log('Service type deleted, hREA will auto-sync:', serviceTypeHash);
      syncInfo.lastSyncEvent = `Auto-deleted: ${serviceTypeHash.toString().slice(-8)}`;
    });

    const unsubscribeUserCreated = storeEventBus.on('user:created', ({ user }) => {
      console.log('User created, hREA auto-creating person agent:', user.name);
      syncInfo.lastSyncEvent = `Auto-user created: ${user.name}`;
    });

    const unsubscribeOrgCreated = storeEventBus.on('organization:created', ({ organization }) => {
      console.log(
        'Organization created, hREA auto-creating organization agent:',
        organization.name
      );
      syncInfo.lastSyncEvent = `Auto-org created: ${organization.name}`;
    });

    unsubscribeFunctions.push(
      unsubscribeApproved,
      unsubscribeRejected,
      unsubscribeDeleted,
      unsubscribeUserCreated,
      unsubscribeOrgCreated
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

  async function loadServiceTypes() {
    try {
      console.log('Loading approved service types for sync info...');
      await runEffect(serviceTypesStore.getApprovedServiceTypes());
    } catch (err) {
      console.error('Error loading service types:', err);
    }
  }

  async function loadUsers() {
    try {
      console.log('Loading users for sync info...');
      await runEffect(administrationStore.fetchAllUsers());
      syncInfo.usersCount = administrationStore.allUsers.length;
    } catch (err) {
      console.error('Error loading users:', err);
    }
  }

  async function manualSyncUsers() {
    try {
      syncLoading = true;
      const results = { synced: 0, created: 0, updated: 0, errors: 0 };

      console.log('Starting manual user sync...');

      for (const user of administrationStore.allUsers) {
        try {
          const userHash = user.original_action_hash?.toString();
          if (!userHash) continue;

          // Check if agent already exists
          const existingAgent = hreaStore.findAgentByActionHash(userHash, 'user');

          if (existingAgent) {
            // Update existing agent
            await runEffect(hreaStore.syncUserToAgent(user));
            results.updated++;
            console.log(`Updated agent for user: ${user.name}`);
          } else {
            // Create new agent
            await runEffect(hreaStore.syncUserToAgent(user));
            results.created++;
            console.log(`Created agent for user: ${user.name}`);
          }

          results.synced++;
        } catch (err) {
          console.error(`Error syncing user ${user.name}:`, err);
          results.errors++;
        }
      }

      syncResults.users = results;
      syncInfo.lastManualSync = `Users: ${results.synced} synced, ${results.created} created, ${results.updated} updated, ${results.errors} errors`;

      // Reload agents to reflect changes
      await runEffect(hreaStore.getAllAgents());
    } catch (err) {
      console.error('Error in manual user sync:', err);
      error = err instanceof Error ? err.message : 'Failed to sync users';
    } finally {
      syncLoading = false;
    }
  }

  async function manualSyncOrganizations() {
    try {
      syncLoading = true;
      const results = { synced: 0, created: 0, updated: 0, errors: 0 };

      console.log('Starting manual organization sync...');

      for (const org of organizationsStore.acceptedOrganizations) {
        try {
          const orgHash = org.original_action_hash?.toString();
          if (!orgHash) continue;

          // Check if agent already exists
          const existingAgent = hreaStore.findAgentByActionHash(orgHash, 'organization');

          if (existingAgent) {
            // Update existing agent
            await runEffect(hreaStore.syncOrganizationToAgent(org));
            results.updated++;
            console.log(`Updated agent for organization: ${org.name}`);
          } else {
            // Create new agent
            await runEffect(hreaStore.syncOrganizationToAgent(org));
            results.created++;
            console.log(`Created agent for organization: ${org.name}`);
          }

          results.synced++;
        } catch (err) {
          console.error(`Error syncing organization ${org.name}:`, err);
          results.errors++;
        }
      }

      syncResults.organizations = results;
      syncInfo.lastManualSync = `Organizations: ${results.synced} synced, ${results.created} created, ${results.updated} updated, ${results.errors} errors`;

      // Reload agents to reflect changes
      await runEffect(hreaStore.getAllAgents());
    } catch (err) {
      console.error('Error in manual organization sync:', err);
      error = err instanceof Error ? err.message : 'Failed to sync organizations';
    } finally {
      syncLoading = false;
    }
  }

  async function manualSyncServiceTypes() {
    try {
      syncLoading = true;
      const results = { synced: 0, created: 0, updated: 0, errors: 0 };

      console.log('Starting manual service type sync...');

      for (const serviceType of serviceTypesStore.approvedServiceTypes) {
        try {
          const serviceTypeHash = serviceType.original_action_hash?.toString();
          if (!serviceTypeHash) continue;

          // Check if resource spec already exists
          const existingResourceSpec = hreaStore.findResourceSpecByActionHash(serviceTypeHash);

          if (existingResourceSpec) {
            // Update existing resource specification
            await runEffect(hreaStore.syncServiceTypeToResourceSpec(serviceType));
            results.updated++;
            console.log(`Updated resource spec for service type: ${serviceType.name}`);
          } else {
            // Create new resource specification
            await runEffect(hreaStore.syncServiceTypeToResourceSpec(serviceType));
            results.created++;
            console.log(`Created resource spec for service type: ${serviceType.name}`);
          }

          results.synced++;
        } catch (err) {
          console.error(`Error syncing service type ${serviceType.name}:`, err);
          results.errors++;
        }
      }

      syncResults.serviceTypes = results;
      syncInfo.lastManualSync = `ServiceTypes: ${results.synced} synced, ${results.created} created, ${results.updated} updated, ${results.errors} errors`;

      // Reload resource specifications to reflect changes
      await runEffect(hreaStore.getAllResourceSpecifications());
    } catch (err) {
      console.error('Error in manual service type sync:', err);
      error = err instanceof Error ? err.message : 'Failed to sync service types';
    } finally {
      syncLoading = false;
    }
  }

  async function manualSyncAll() {
    try {
      console.log('Starting service type sync...');
      await manualSyncServiceTypes();
      console.log('Service type sync completed');
    } catch (err) {
      console.error('Error in service type sync:', err);
      error = err instanceof Error ? err.message : 'Failed to sync service types';
    }
  }

  function extractActionHashFromNote(
    note: string,
    entityType: 'user' | 'organization' | 'serviceType'
  ): string | null {
    const prefix = `ref:${entityType}:`;
    if (note.startsWith(prefix)) {
      return note.substring(prefix.length);
    }
    return null;
  }

  function findServiceTypeByActionHash(actionHash: string): UIServiceType | null {
    return (
      serviceTypesStore.approvedServiceTypes.find(
        (st) => st.original_action_hash?.toString() === actionHash
      ) || null
    );
  }

  async function navigateToServiceType(resourceSpec: ResourceSpecification) {
    if (!resourceSpec.note?.startsWith('ref:serviceType:')) {
      console.warn('Resource specification does not have a service type reference');
      return;
    }

    const actionHash = extractActionHashFromNote(resourceSpec.note, 'serviceType');

    if (!actionHash) {
      console.warn('Could not extract action hash from note');
      return;
    }

    const serviceType = findServiceTypeByActionHash(actionHash);
    if (!serviceType) {
      console.warn('Service type not found for action hash:', actionHash);
      error = 'Associated service type not found';
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

    // Navigate to service type detail page
    goto(`/service-types/${navigationHash}`);
  }

  onMount(async () => {
    console.log('ResourceSpecManager mounted');
    console.log('hreaStore state:', {
      resourceSpecifications: hreaStore.resourceSpecifications,
      agents: hreaStore.agents,
      loading: hreaStore.loading,
      error: hreaStore.error,
      apolloClient: hreaStore.apolloClient
    });

    // Setup event listeners for automatic syncing
    setupEventListeners();

    // Load initial data
    await loadHreaData();
    await loadServiceTypes();
    await loadUsers();
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
        await loadServiceTypes();
        await loadUsers();
      }}
      disabled={loading || hreaStore.loading || syncLoading}
    >
      <i class="fa-solid fa-refresh"></i>
      <span>Refresh</span>
    </button>
    <button
      class="variant-filled-primary btn btn-sm"
      onclick={manualSyncAll}
      disabled={loading || hreaStore.loading || syncLoading}
    >
      <i class="fa-solid fa-sync"></i>
      <span>Manual Sync</span>
    </button>
  </div>

  <!-- Sync Status Card -->
  <div class="card bg-surface-100-800-token p-4">
    <h3 class="mb-3 text-lg font-semibold">Service Type → hREA Synchronization Status</h3>
    <div class="grid grid-cols-2 gap-4 text-center md:grid-cols-3">
      <div class="space-y-1">
        <div class="text-2xl font-bold text-primary-500">{syncInfo.serviceTypesCount}</div>
        <div class="text-sm text-surface-600 dark:text-surface-400">Approved Service Types</div>
      </div>
      <div class="space-y-1">
        <div class="text-2xl font-bold text-secondary-500">
          {serviceTypeResourceSpecs.length}
        </div>
        <div class="text-sm text-surface-600 dark:text-surface-400">
          hREA Resource Specs (Service Types)
        </div>
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
      Note: Service Type resource specifications are created automatically when service types are approved.
      Action hash references enable independent updates.
    </div>
  </div>

  <!-- Manual Sync Results -->
  {#if syncResults.serviceTypes.synced > 0}
    <div class="card bg-surface-50-900-token p-4">
      <h3 class="mb-3 text-lg font-semibold">Manual Sync Results</h3>
      <div class="rounded bg-primary-500/10 p-3">
        <h4 class="font-semibold text-primary-500">Service Types</h4>
        <div class="space-y-1 text-sm">
          <div>Synced: {syncResults.serviceTypes.synced}</div>
          <div>Created: {syncResults.serviceTypes.created}</div>
          <div>Updated: {syncResults.serviceTypes.updated}</div>
          {#if syncResults.serviceTypes.errors > 0}
            <div class="text-error-500">Errors: {syncResults.serviceTypes.errors}</div>
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

  <!-- Service Type Resource Specifications Content -->
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">
        Service Type Resource Specifications ({serviceTypeResourceSpecs.length})
      </h3>
      <div class="text-sm text-surface-500">
        Click on a resource specification to view its associated service type
      </div>
    </div>

    {#if loading || hreaStore.loading}
      <div class="flex items-center justify-center p-8">
        <i class="fa-solid fa-spinner animate-spin text-2xl text-primary-500"></i>
        <span class="ml-2">Loading resource specifications...</span>
      </div>
    {:else if serviceTypeResourceSpecs.length === 0}
      <div class="card p-8 text-center text-surface-500">
        <i class="fa-solid fa-tags mb-4 text-4xl"></i>
        <p>No service type resource specifications found in hREA DHT</p>
        <p class="mt-2 text-sm">
          Resource specifications will be created when service types are approved or via manual sync
        </p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each serviceTypeResourceSpecs as spec}
          <div
            class="card cursor-pointer space-y-3 p-4 transition-colors hover:bg-surface-100-800-token"
            onclick={() => navigateToServiceType(spec)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateToServiceType(spec);
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
            {#if spec.note?.startsWith('ref:serviceType:')}
              {@const actionHash = extractActionHashFromNote(spec.note, 'serviceType')}
              {@const serviceType = actionHash ? findServiceTypeByActionHash(actionHash) : null}

              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="variant-soft-primary badge text-xs"> Service Type Reference </span>
                  {#if serviceType}
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

                {#if serviceType}
                  <div class="bg-surface-100-800-token rounded p-2 text-sm">
                    <div class="font-medium text-surface-700 dark:text-surface-300">
                      Associated Service Type:
                    </div>
                    <div class="text-surface-600 dark:text-surface-400">
                      {serviceType.name}
                    </div>
                    {#if serviceType.description}
                      <div class="mt-1 line-clamp-2 text-xs text-surface-500">
                        {serviceType.description}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <div class="rounded bg-warning-500/10 p-2 text-sm">
                    <div class="text-warning-700 dark:text-warning-300">
                      Associated service type not found
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
