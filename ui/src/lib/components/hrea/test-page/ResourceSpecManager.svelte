<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { TabGroup, Tab } from '@skeletonlabs/skeleton';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { storeEventBus } from '$lib/stores/storeEvents';
  import type { ResourceSpecification, Agent } from '$lib/types/hrea';
  import type { UIServiceType, UIUser, UIOrganization } from '$lib/types/ui';
  import { runEffect } from '@/lib/utils/effect';

  let resourceSpecSubTab = $state(0);
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
      await administrationStore.getAllUsers();
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
      console.log('Starting full manual sync...');
      await manualSyncUsers();
      await manualSyncOrganizations();
      await manualSyncServiceTypes();
      console.log('Full manual sync completed');
    } catch (err) {
      console.error('Error in full manual sync:', err);
      error = err instanceof Error ? err.message : 'Failed to perform full sync';
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
  <header class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold">hREA Resource Specifications</h2>
      <p class="text-surface-600 dark:text-surface-400">
        Monitor hREA DHT synchronization via action hash references (independent updates)
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="btn variant-soft-surface btn-sm"
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
        class="btn variant-filled-primary btn-sm"
        onclick={manualSyncAll}
        disabled={loading || hreaStore.loading || syncLoading}
      >
        <i class="fa-solid fa-sync"></i>
        <span>Manual Sync All</span>
      </button>
    </div>
  </header>

  <!-- Sync Status Card -->
  <div class="card bg-surface-100-800-token p-4">
    <h3 class="mb-3 text-lg font-semibold">hREA Synchronization Status</h3>
    <div class="grid grid-cols-2 gap-4 text-center md:grid-cols-4">
      <div class="space-y-1">
        <div class="text-primary-500 text-2xl font-bold">{syncInfo.serviceTypesCount}</div>
        <div class="text-surface-600 dark:text-surface-400 text-sm">Approved Service Types</div>
      </div>
      <div class="space-y-1">
        <div class="text-secondary-500 text-2xl font-bold">{syncInfo.resourceSpecsCount}</div>
        <div class="text-surface-600 dark:text-surface-400 text-sm">hREA Resource Specs</div>
      </div>
      <div class="space-y-1">
        <div class="text-tertiary-500 text-2xl font-bold">{syncInfo.usersCount}</div>
        <div class="text-surface-600 dark:text-surface-400 text-sm">Users</div>
      </div>
      <div class="space-y-1">
        <div class="text-success-500 text-2xl font-bold">{syncInfo.agentsCount}</div>
        <div class="text-surface-600 dark:text-surface-400 text-sm">hREA Agents</div>
      </div>
    </div>

    <!-- Manual Sync Controls -->
    <div class="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
      <button
        class="btn variant-soft-primary btn-sm"
        onclick={manualSyncUsers}
        disabled={syncLoading}
      >
        <i class="fa-solid fa-users"></i>
        <span>Sync Users</span>
      </button>
      <button
        class="btn variant-soft-secondary btn-sm"
        onclick={manualSyncOrganizations}
        disabled={syncLoading}
      >
        <i class="fa-solid fa-building"></i>
        <span>Sync Organizations</span>
      </button>
      <button
        class="btn variant-soft-tertiary btn-sm"
        onclick={manualSyncServiceTypes}
        disabled={syncLoading}
      >
        <i class="fa-solid fa-tags"></i>
        <span>Sync Service Types</span>
      </button>
    </div>

    <div class="bg-surface-200-700-token mt-4 rounded p-2 text-sm">
      <strong>Last Auto Event:</strong>
      {syncInfo.lastSyncEvent}
    </div>
    <div class="bg-surface-200-700-token mt-2 rounded p-2 text-sm">
      <strong>Last Manual Sync:</strong>
      {syncInfo.lastManualSync}
    </div>
    <div class="text-surface-500 mt-2 text-xs">
      <i class="fa-solid fa-info-circle mr-1"></i>
      hREA entities use action hash references for independent updates. Manual sync available for full
      control.
    </div>
  </div>

  <!-- Manual Sync Results -->
  {#if syncResults.users.synced > 0 || syncResults.organizations.synced > 0 || syncResults.serviceTypes.synced > 0}
    <div class="card bg-surface-50-900-token p-4">
      <h3 class="mb-3 text-lg font-semibold">Manual Sync Results</h3>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        {#if syncResults.users.synced > 0}
          <div class="bg-primary-500/10 rounded p-3">
            <h4 class="text-primary-500 font-semibold">Users</h4>
            <div class="space-y-1 text-sm">
              <div>Synced: {syncResults.users.synced}</div>
              <div>Created: {syncResults.users.created}</div>
              <div>Updated: {syncResults.users.updated}</div>
              {#if syncResults.users.errors > 0}
                <div class="text-error-500">Errors: {syncResults.users.errors}</div>
              {/if}
            </div>
          </div>
        {/if}
        {#if syncResults.organizations.synced > 0}
          <div class="bg-secondary-500/10 rounded p-3">
            <h4 class="text-secondary-500 font-semibold">Organizations</h4>
            <div class="space-y-1 text-sm">
              <div>Synced: {syncResults.organizations.synced}</div>
              <div>Created: {syncResults.organizations.created}</div>
              <div>Updated: {syncResults.organizations.updated}</div>
              {#if syncResults.organizations.errors > 0}
                <div class="text-error-500">Errors: {syncResults.organizations.errors}</div>
              {/if}
            </div>
          </div>
        {/if}
        {#if syncResults.serviceTypes.synced > 0}
          <div class="bg-tertiary-500/10 rounded p-3">
            <h4 class="text-tertiary-500 font-semibold">Service Types</h4>
            <div class="space-y-1 text-sm">
              <div>Synced: {syncResults.serviceTypes.synced}</div>
              <div>Created: {syncResults.serviceTypes.created}</div>
              <div>Updated: {syncResults.serviceTypes.updated}</div>
              {#if syncResults.serviceTypes.errors > 0}
                <div class="text-error-500">Errors: {syncResults.serviceTypes.errors}</div>
              {/if}
            </div>
          </div>
        {/if}
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

  <!-- Main Content -->
  <TabGroup>
    <Tab bind:group={resourceSpecSubTab} name="tab1" value={0}>Resource Specifications</Tab>
    <Tab bind:group={resourceSpecSubTab} name="tab2" value={1}>Agents</Tab>
    <Tab bind:group={resourceSpecSubTab} name="tab3" value={2}>Action Hash References</Tab>

    <!-- Tab Panels -->
    <svelte:fragment slot="panel">
      {#if resourceSpecSubTab === 0}
        <!-- Resource Specifications Tab -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              Resource Specifications ({hreaStore.resourceSpecifications.length})
            </h3>
          </div>

          {#if loading || hreaStore.loading}
            <div class="flex items-center justify-center p-8">
              <i class="fa-solid fa-spinner text-primary-500 animate-spin text-2xl"></i>
              <span class="ml-2">Loading resource specifications...</span>
            </div>
          {:else if hreaStore.resourceSpecifications.length === 0}
            <div class="card text-surface-500 p-8 text-center">
              <i class="fa-solid fa-cube mb-4 text-4xl"></i>
              <p>No resource specifications found in hREA DHT</p>
              <p class="mt-2 text-sm">
                Resource specifications will be created when service types are approved or via
                manual sync
              </p>
            </div>
          {:else}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each hreaStore.resourceSpecifications as spec}
                <div class="card space-y-2 p-4">
                  <h4 class="font-semibold">{spec.name}</h4>
                  {#if spec.note}
                    <div class="text-surface-600 dark:text-surface-400 text-xs">
                      {#if spec.note.startsWith('ref:serviceType:')}
                        <span class="badge variant-soft-primary text-xs">
                          Ref: {extractActionHashFromNote(spec.note, 'serviceType')?.slice(-8) ||
                            'Unknown'}
                        </span>
                      {:else}
                        <p class="text-sm">{spec.note}</p>
                      {/if}
                    </div>
                  {/if}
                  {#if spec.classifiedAs}
                    <div class="flex flex-wrap gap-1">
                      {#each spec.classifiedAs as classification}
                        <span class="badge variant-soft-secondary text-xs"
                          >{classification.split('/').pop()}</span
                        >
                      {/each}
                    </div>
                  {/if}
                  <div class="text-surface-500 text-xs">ID: {spec.id.slice(-8)}</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if resourceSpecSubTab === 1}
        <!-- Agents Tab -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">hREA Agents ({hreaStore.agents.length})</h3>
          </div>

          {#if loading || hreaStore.loading}
            <div class="flex items-center justify-center p-8">
              <i class="fa-solid fa-spinner text-primary-500 animate-spin text-2xl"></i>
              <span class="ml-2">Loading agents...</span>
            </div>
          {:else if hreaStore.agents.length === 0}
            <div class="card text-surface-500 p-8 text-center">
              <i class="fa-solid fa-users mb-4 text-4xl"></i>
              <p>No agents found in hREA DHT</p>
              <p class="mt-2 text-sm">
                Agents will be created when users and organizations are created or via manual sync
              </p>
            </div>
          {:else}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each hreaStore.agents as agent}
                <div class="card space-y-2 p-4">
                  <h4 class="font-semibold">{agent.name}</h4>
                  {#if agent.note}
                    <div class="text-surface-600 dark:text-surface-400 text-xs">
                      {#if agent.note.startsWith('ref:user:')}
                        <span class="badge variant-soft-primary text-xs">
                          User Ref: {extractActionHashFromNote(agent.note, 'user')?.slice(-8) ||
                            'Unknown'}
                        </span>
                      {:else if agent.note.startsWith('ref:organization:')}
                        <span class="badge variant-soft-secondary text-xs">
                          Org Ref: {extractActionHashFromNote(agent.note, 'organization')?.slice(
                            -8
                          ) || 'Unknown'}
                        </span>
                      {:else}
                        <p class="text-sm">{agent.note}</p>
                      {/if}
                    </div>
                  {/if}
                  <div class="text-surface-500 text-xs">ID: {agent.id.slice(-8)}</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if resourceSpecSubTab === 2}
        <!-- Action Hash References Tab -->
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Action Hash Reference System</h3>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <!-- Service Type → Resource Specification References -->
            <div class="card p-4">
              <h4 class="mb-3 font-semibold">Service Types → Resource Specifications</h4>
              {#if hreaStore.resourceSpecifications.length === 0}
                <p class="text-surface-500 text-sm">No resource specifications found</p>
              {:else}
                <div class="space-y-2">
                  {#each hreaStore.resourceSpecifications as spec}
                    {#if spec.note?.startsWith('ref:serviceType:')}
                      <div class="bg-surface-100-800-token rounded p-2 text-xs">
                        <div><strong>Resource Spec:</strong> {spec.name}</div>
                        <div>
                          <strong>References:</strong>
                          {extractActionHashFromNote(spec.note, 'serviceType')?.slice(-12) ||
                            'Unknown'}
                        </div>
                        <div><strong>hREA ID:</strong> {spec.id.slice(-8)}</div>
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>

            <!-- User/Organization → Agent References -->
            <div class="card p-4">
              <h4 class="mb-3 font-semibold">Users/Organizations → Person/Organization Agents</h4>
              {#if hreaStore.agents.length === 0}
                <p class="text-surface-500 text-sm">No agents found</p>
              {:else}
                <div class="space-y-2">
                  {#each hreaStore.agents as agent}
                    {#if agent.note?.startsWith('ref:')}
                      <div class="bg-surface-100-800-token rounded p-2 text-xs">
                        <div><strong>Agent:</strong> {agent.name}</div>
                        <div>
                          <strong>Type:</strong>
                          {#if agent.note.startsWith('ref:user:')}
                            <span class="badge variant-soft-primary text-xs">User</span>
                          {:else if agent.note.startsWith('ref:organization:')}
                            <span class="badge variant-soft-secondary text-xs">Organization</span>
                          {/if}
                        </div>
                        <div>
                          <strong>References:</strong>
                          {extractActionHashFromNote(
                            agent.note,
                            agent.note.startsWith('ref:user:') ? 'user' : 'organization'
                          )?.slice(-12) || 'Unknown'}
                        </div>
                        <div><strong>hREA ID:</strong> {agent.id.slice(-8)}</div>
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <!-- Explanation -->
          <div class="card bg-surface-50-900-token p-4">
            <h4 class="text-primary-500 mb-2 font-semibold">Action Hash Reference System</h4>
            <div class="space-y-2 text-sm">
              <p>
                <strong>Note Format:</strong>
                <code>ref:&#123;entityType&#125;:&#123;actionHash&#125;</code>
              </p>
              <p>
                <strong>Independence:</strong> hREA entities can be updated manually without being coupled
                to main DNA updates.
              </p>
              <p>
                <strong>Lookup:</strong> Original entities can be found by searching hREA note fields
                for action hash references.
              </p>
              <p>
                <strong>Manual Sync:</strong> Use the sync buttons to explicitly synchronize entities
                when needed.
              </p>
            </div>
          </div>
        </div>
      {/if}
    </svelte:fragment>
  </TabGroup>
</div>
