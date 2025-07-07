<script lang="ts">
  import { onMount } from 'svelte';
  import { TabGroup, Tab } from '@skeletonlabs/skeleton';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import type { ResourceSpecification } from '$lib/types/hrea';
  import { runEffect } from '@/lib/utils/effect';

  let resourceSpecSubTab = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Access store properties directly for reactivity
  // Don't destructure - access through the store proxy
  let serviceSpecs = $derived.by(() => {
    console.log(
      'serviceSpecs derived - all resourceSpecifications:',
      hreaStore.resourceSpecifications
    );
    return hreaStore.resourceSpecifications.filter(
      (spec) => !spec.classifiedAs?.includes('http://www.productontology.org/id/Medium_of_exchange')
    );
  });

  let mediumOfExchangeSpecs = $derived.by(() => {
    return hreaStore.resourceSpecifications.filter((spec) =>
      spec.classifiedAs?.includes('http://www.productontology.org/id/Medium_of_exchange')
    );
  });

  // Statistics - also access store directly
  let stats = $derived.by(() => ({
    total: hreaStore.resourceSpecifications.length,
    services: serviceSpecs.length,
    mediumOfExchange: mediumOfExchangeSpecs.length
  }));

  onMount(async () => {
    console.log('ResourceSpecManager mounted');
    console.log('hreaStore state:', {
      resourceSpecifications: hreaStore.resourceSpecifications,
      loading: hreaStore.loading,
      error: hreaStore.error,
      apolloClient: hreaStore.apolloClient
    });
    await loadResourceSpecifications();
  });

  async function loadResourceSpecifications() {
    loading = true;
    error = null;
    console.log('Loading resource specifications...');

    try {
      // First ensure hREA is initialized
      if (!hreaStore.apolloClient) {
        console.log('Apollo client not initialized, initializing...');
        await hreaStore.initialize();
      }

      console.log('Calling getAllResourceSpecifications...');
      await hreaStore.getAllResourceSpecifications();
      console.log('getAllResourceSpecifications completed');
      console.log('Resource specifications after load:', hreaStore.resourceSpecifications);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load resource specifications';
      console.error('Error loading resource specifications:', err);
    } finally {
      loading = false;
    }
  }

  function getResourceSpecIcon(spec: ResourceSpecification) {
    const isMediumOfExchange = spec.classifiedAs?.includes(
      'http://www.productontology.org/id/Medium_of_exchange'
    );
    return isMediumOfExchange ? '💰' : '🔧';
  }

  function getResourceSpecType(spec: ResourceSpecification) {
    const isMediumOfExchange = spec.classifiedAs?.includes(
      'http://www.productontology.org/id/Medium_of_exchange'
    );
    return isMediumOfExchange ? 'Medium of Exchange' : 'Service';
  }

  function handleEdit(spec: ResourceSpecification) {
    // TODO: Implement edit functionality
    console.log('Edit resource specification:', spec);
  }

  function handleDelete(spec: ResourceSpecification) {
    // TODO: Implement delete functionality
    console.log('Delete resource specification:', spec);
  }

  function handleCreate() {
    // TODO: Implement create functionality
    console.log('Create new resource specification');
  }

  async function createResourceSpecFromServiceTypes() {
    console.log('Creating resource specifications from existing approved service types...');
    loading = true;
    error = null;

    try {
      // First ensure hREA is initialized
      if (!hreaStore.apolloClient) {
        console.log('Apollo client not initialized, initializing...');
        await hreaStore.initialize();
      }

      // Get existing approved service types from the service types store
      console.log('Loading approved service types...');
      const serviceTypesStore = (await import('$lib/stores/serviceTypes.store.svelte')).default;
      await serviceTypesStore.getApprovedServiceTypes();

      const approvedServiceTypes = serviceTypesStore.approvedServiceTypes;
      console.log('Found approved service types:', approvedServiceTypes.length);

      if (approvedServiceTypes.length === 0) {
        error =
          'No approved service types found. Please create and approve some service types first.';
        return;
      }

      // Map each approved service type to a resource specification
      let createdCount = 0;
      for (const serviceType of approvedServiceTypes) {
        try {
          console.log(`Creating resource specification for service type: ${serviceType.name}`);
          const result = await runEffect(
            hreaStore.createResourceSpecificationFromServiceType(serviceType)
          );
          if (result) {
            createdCount++;
            console.log(`Successfully created resource specification for: ${serviceType.name}`);
          } else {
            console.log(`Resource specification already exists for: ${serviceType.name}`);
          }
        } catch (err) {
          console.error(`Failed to create resource specification for ${serviceType.name}:`, err);
        }
      }

      console.log(
        `Created ${createdCount} new resource specifications from ${approvedServiceTypes.length} approved service types`
      );

      // Refresh the resource specifications list

      runEffect(hreaStore.getAllResourceSpecifications());
      console.log('Resource specifications after mapping:', hreaStore.resourceSpecifications);
    } catch (err) {
      error =
        err instanceof Error
          ? err.message
          : 'Failed to create resource specifications from service types';
      console.error('Error creating resource specifications from service types:', err);
    } finally {
      loading = false;
    }
  }
</script>

<div class="space-y-4">
  <!-- Header with Statistics -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <i class="fa-solid fa-list-check text-primary-500 text-xl"></i>
      <h4 class="h4">Resource Specifications</h4>
    </div>
    <div class="flex items-center gap-2">
      <button
        class="btn variant-soft-surface btn-sm"
        onclick={loadResourceSpecifications}
        disabled={loading || hreaStore.loading}
      >
        <i class="fa-solid fa-refresh"></i>
        <span>Refresh</span>
      </button>
      <button
        class="btn variant-filled-primary btn-sm"
        onclick={handleCreate}
        disabled={loading || hreaStore.loading}
      >
        <i class="fa-solid fa-plus"></i>
        <span>Create Resource Spec</span>
      </button>
      <button
        class="btn variant-filled-secondary btn-sm"
        onclick={createResourceSpecFromServiceTypes}
        disabled={loading || hreaStore.loading}
      >
        <i class="fa-solid fa-sync"></i>
        <span>Map Service Types</span>
      </button>
    </div>
  </div>

  <!-- Statistics Cards -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <div class="card space-y-2 p-4">
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-chart-bar text-surface-500"></i>
        <span class="text-sm font-medium">Total</span>
      </div>
      <div class="text-2xl font-bold">{stats.total}</div>
    </div>
    <div class="card space-y-2 p-4">
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-wrench text-blue-500"></i>
        <span class="text-sm font-medium">Services</span>
      </div>
      <div class="text-2xl font-bold">{stats.services}</div>
    </div>
    <div class="card space-y-2 p-4">
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-coins text-green-500"></i>
        <span class="text-sm font-medium">Medium of Exchange</span>
      </div>
      <div class="text-2xl font-bold">{stats.mediumOfExchange}</div>
    </div>
  </div>

  <!-- Error Display -->
  {#if error || hreaStore.error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h4">Error</h3>
        <p>{error || hreaStore.error?.message}</p>
      </div>
      <div class="alert-actions">
        <button class="btn variant-filled" onclick={loadResourceSpecifications}> Retry </button>
      </div>
    </div>
  {/if}

  <!-- Resource Specification Tabs -->
  <TabGroup>
    <Tab bind:group={resourceSpecSubTab} name="services" value={0}>
      <svelte:fragment slot="lead">
        <i class="fa-solid fa-wrench text-base"></i>
      </svelte:fragment>
      Services ({stats.services})
    </Tab>
    <Tab bind:group={resourceSpecSubTab} name="medium-of-exchange" value={1}>
      <svelte:fragment slot="lead">
        <i class="fa-solid fa-coins text-base"></i>
      </svelte:fragment>
      Medium of Exchange ({stats.mediumOfExchange})
    </Tab>

    <!-- Tab Panels -->
    <svelte:fragment slot="panel">
      {#if resourceSpecSubTab === 0}
        <!-- Service Resource Specifications -->
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-wrench text-blue-500"></i>
            <h5 class="h5">Service Resource Specifications</h5>
            <span class="badge variant-soft-surface">{stats.services}</span>
          </div>

          {#if loading || hreaStore.loading}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each Array(6) as _}
                <div class="card space-y-4 p-4">
                  <div class="placeholder h-4 w-3/4 animate-pulse"></div>
                  <div class="placeholder h-3 w-1/2 animate-pulse"></div>
                  <div class="placeholder h-8 w-full animate-pulse"></div>
                </div>
              {/each}
            </div>
          {:else if serviceSpecs.length === 0}
            <div class="card space-y-4 p-8 text-center">
              <i class="fa-solid fa-wrench text-surface-400-500-token text-4xl"></i>
              <h6 class="h6">No Service Resource Specifications</h6>
              <p class="text-surface-600-300-token">
                No service resource specifications have been created yet.
              </p>
            </div>
          {:else}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each serviceSpecs as spec}
                <div class="card space-y-4 p-4">
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                      <span class="text-2xl">{getResourceSpecIcon(spec)}</span>
                      <div>
                        <h6 class="h6">{spec.name}</h6>
                        <p class="text-surface-600-300-token text-sm">
                          {getResourceSpecType(spec)}
                        </p>
                      </div>
                    </div>
                    <div class="flex gap-1">
                      <button
                        class="btn btn-sm variant-soft-surface"
                        onclick={() => handleEdit(spec)}
                        aria-label="Edit resource specification"
                        title="Edit"
                      >
                        <i class="fa-solid fa-edit"></i>
                      </button>
                      <button
                        class="btn btn-sm variant-soft-error"
                        onclick={() => handleDelete(spec)}
                        aria-label="Delete resource specification"
                        title="Delete"
                      >
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  {#if spec.note}
                    <p class="text-surface-600-300-token text-sm">{spec.note}</p>
                  {/if}

                  <div class="text-surface-500 flex items-center gap-2 text-xs">
                    <i class="fa-solid fa-fingerprint"></i>
                    <span class="font-mono">{spec.id.slice(-8)}</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if resourceSpecSubTab === 1}
        <!-- Medium of Exchange Resource Specifications -->
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-coins text-green-500"></i>
            <h5 class="h5">Medium of Exchange Resource Specifications</h5>
            <span class="badge variant-soft-surface">{stats.mediumOfExchange}</span>
          </div>

          {#if loading || hreaStore.loading}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each Array(6) as _}
                <div class="card space-y-4 p-4">
                  <div class="placeholder h-4 w-3/4 animate-pulse"></div>
                  <div class="placeholder h-3 w-1/2 animate-pulse"></div>
                  <div class="placeholder h-8 w-full animate-pulse"></div>
                </div>
              {/each}
            </div>
          {:else if mediumOfExchangeSpecs.length === 0}
            <div class="card space-y-4 p-8 text-center">
              <i class="fa-solid fa-coins text-surface-400-500-token text-4xl"></i>
              <h6 class="h6">No Medium of Exchange Resource Specifications</h6>
              <p class="text-surface-600-300-token">
                No medium of exchange resource specifications have been created yet.
              </p>
            </div>
          {:else}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each mediumOfExchangeSpecs as spec}
                <div class="card space-y-4 p-4">
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                      <span class="text-2xl">{getResourceSpecIcon(spec)}</span>
                      <div>
                        <h6 class="h6">{spec.name}</h6>
                        <p class="text-surface-600-300-token text-sm">
                          {getResourceSpecType(spec)}
                        </p>
                      </div>
                    </div>
                    <div class="flex gap-1">
                      <button
                        class="btn btn-sm variant-soft-surface"
                        onclick={() => handleEdit(spec)}
                        aria-label="Edit resource specification"
                        title="Edit"
                      >
                        <i class="fa-solid fa-edit"></i>
                      </button>
                      <button
                        class="btn btn-sm variant-soft-error"
                        onclick={() => handleDelete(spec)}
                        aria-label="Delete resource specification"
                        title="Delete"
                      >
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  {#if spec.note}
                    <p class="text-surface-600-300-token text-sm">{spec.note}</p>
                  {/if}

                  <div class="text-surface-500 flex items-center gap-2 text-xs">
                    <i class="fa-solid fa-fingerprint"></i>
                    <span class="font-mono">{spec.id.slice(-8)}</span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </svelte:fragment>
  </TabGroup>
</div>
