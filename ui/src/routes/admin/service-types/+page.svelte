<script lang="ts">
    import { onMount } from 'svelte';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { Effect } from 'effect';
    import type { ActionHash } from '@holochain/client';
    import type { UIServiceType } from '$lib/types/ui';
    import type { ServiceTypeInDHT } from '$lib/types/holochain';
    import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
    import ServiceTypeForm from '$lib/components/service-types/ServiceTypeForm.svelte';
    import ServiceTypeCard from '$lib/components/service-types/ServiceTypeCard.svelte';
    import { runEffect } from '$lib/utils/effect';
  
    const toastStore = getToastStore();
  
    let pageState = $state({
      isLoading: true,
      error: null as string | null,
      showCreateForm: false,
      editingServiceType: null as UIServiceType | null,
      searchTerm: '',
      selectedCategory: 'all'
    });
  
    // Reactive getters from store
    const serviceTypes = $derived(serviceTypesStore.serviceTypes);
    const storeLoading = $derived(serviceTypesStore.loading);
    const storeError = $derived(serviceTypesStore.error);
  
    // Filtered service types based on search and category
    const filteredServiceTypes = $derived(serviceTypes.filter((serviceType) => {
      const matchesSearch = 
        serviceType.name.toLowerCase().includes(pageState.searchTerm.toLowerCase()) ||
        serviceType.description.toLowerCase().includes(pageState.searchTerm.toLowerCase()) ||
        serviceType.tags.some(tag => tag.toLowerCase().includes(pageState.searchTerm.toLowerCase()));
      
      const matchesCategory = 
        pageState.selectedCategory === 'all' || 
        serviceType.tags.includes(pageState.selectedCategory);
      
      return matchesSearch && matchesCategory;
    }));
  
    // Get unique categories from all service types
    const categories = $derived(['all', ...new Set(serviceTypes.flatMap(st => st.tags))]);
  
    async function loadServiceTypes() {
      pageState.isLoading = true;
      pageState.error = null;
  
      try {
        await runEffect(serviceTypesStore.getAllServiceTypes());
      } catch (error) {
        pageState.error = error instanceof Error ? error.message : 'Failed to load service types';
        toastStore.trigger({
          message: 'Failed to load service types. Please try again.',
          background: 'variant-filled-error'
        });
      } finally {
        pageState.isLoading = false;
      }
    }
  
    async function handleCreateServiceType(input: ServiceTypeInDHT) {
      try {
        await runEffect(serviceTypesStore.createServiceType(input));
        pageState.showCreateForm = false;
        toastStore.trigger({
          message: 'Service type created successfully',
          background: 'variant-filled-success'
        });
      } catch (error) {
        toastStore.trigger({
          message: `Failed to create service type: ${error}`,
          background: 'variant-filled-error'
        });
      }
    }
  
    async function handleUpdateServiceType(
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      input: ServiceTypeInDHT
    ) {
      try {
        await runEffect(serviceTypesStore.updateServiceType(originalActionHash, previousActionHash, input));
        pageState.editingServiceType = null;
        toastStore.trigger({
          message: 'Service type updated successfully',
          background: 'variant-filled-success'
        });
      } catch (error) {
        toastStore.trigger({
          message: `Failed to update service type: ${error}`,
          background: 'variant-filled-error'
        });
      }
    }
  
    async function handleDeleteServiceType(serviceTypeHash: ActionHash) {
      if (!confirm('Are you sure you want to delete this service type? This action cannot be undone.')) {
        return;
      }
  
      try {
        await runEffect(serviceTypesStore.deleteServiceType(serviceTypeHash));
        toastStore.trigger({
          message: 'Service type deleted successfully',
          background: 'variant-filled-success'
        });
      } catch (error) {
        toastStore.trigger({
          message: `Failed to delete service type: ${error}`,
          background: 'variant-filled-error'
        });
      }
    }
  
    function handleEdit(serviceType: UIServiceType) {
      pageState.editingServiceType = serviceType;
      pageState.showCreateForm = false;
    }
  
    function handleCancelEdit() {
      pageState.editingServiceType = null;
    }
  
    function handleShowCreateForm() {
      pageState.showCreateForm = true;
      pageState.editingServiceType = null;
    }
  
    onMount(loadServiceTypes);
  </script>
  
  <section class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="h1">Service Types Management</h1>
      <button 
        class="btn variant-filled-primary"
        onclick={handleShowCreateForm}
        disabled={pageState.showCreateForm || pageState.editingServiceType !== null}
      >
        Create Service Type
      </button>
    </div>
  
    <!-- Loading State -->
    {#if pageState.isLoading || storeLoading}
      <div class="flex items-center justify-center space-x-2 text-center">
        <span class="loading loading-spinner"></span>
        <span>Loading service types...</span>
      </div>
    
    <!-- Error State -->
    {:else if pageState.error || storeError}
      <div class="alert variant-filled-error">
        <div class="alert-message">
          <h3 class="h3">Error</h3>
          <p>{pageState.error || storeError}</p>
        </div>
        <div class="alert-actions">
          <button class="btn btn-sm" onclick={loadServiceTypes}>
            Try Again
          </button>
        </div>
      </div>
  
    {:else}
      <!-- Create Form -->
      {#if pageState.showCreateForm}
        <div class="card p-4">
          <header class="card-header">
            <h2 class="h2">Create New Service Type</h2>
          </header>
          <section class="p-4">
            <ServiceTypeForm
              mode="create"
              onSubmit={handleCreateServiceType}
              onCancel={() => (pageState.showCreateForm = false)}
            />
          </section>
        </div>
      {/if}
  
      <!-- Edit Form -->
      {#if pageState.editingServiceType}
        <div class="card p-4">
          <header class="card-header">
            <h2 class="h2">Edit Service Type</h2>
          </header>
          <section class="p-4">
            <ServiceTypeForm
              mode="edit"
              serviceType={pageState.editingServiceType}
              onSubmit={(input) => {
                if (pageState.editingServiceType?.original_action_hash && pageState.editingServiceType?.previous_action_hash) {
                  return handleUpdateServiceType(
                    pageState.editingServiceType.original_action_hash,
                    pageState.editingServiceType.previous_action_hash,
                    input
                  );
                }
                return Promise.reject(new Error('Missing action hashes'));
              }}
              onCancel={handleCancelEdit}
            />
          </section>
        </div>
      {/if}
  
      <!-- Search and Filter Controls -->
      <div class="card p-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Search -->
          <label class="label">
            <span>Search Service Types</span>
            <input
              type="text"
              class="input"
              placeholder="Search by name, description, or tags..."
              bind:value={pageState.searchTerm}
            />
          </label>
  
          <!-- Category Filter -->
          <label class="label">
            <span>Filter by Category</span>
            <select class="select" bind:value={pageState.selectedCategory}>
              {#each categories as category}
                <option value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              {/each}
            </select>
          </label>
        </div>
      </div>
  
      <!-- Service Types List -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="h2">
            Service Types ({filteredServiceTypes.length})
          </h2>
          {#if pageState.searchTerm || pageState.selectedCategory !== 'all'}
            <button 
              class="btn btn-sm variant-ghost-surface"
              onclick={() => {
                pageState.searchTerm = '';
                pageState.selectedCategory = 'all';
              }}
            >
              Clear Filters
            </button>
          {/if}
        </div>
  
        {#if filteredServiceTypes.length === 0}
          <div class="card p-8 text-center">
            <h3 class="h3">No Service Types Found</h3>
            <p class="text-surface-600">
              {#if pageState.searchTerm || pageState.selectedCategory !== 'all'}
                No service types match your current filters.
              {:else}
                No service types have been created yet.
              {/if}
            </p>
            {#if !pageState.searchTerm && pageState.selectedCategory === 'all'}
              <button 
                class="btn variant-filled-primary mt-4"
                onclick={handleShowCreateForm}
              >
                Create First Service Type
              </button>
            {/if}
          </div>
        {:else}
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {#each filteredServiceTypes as serviceType (serviceType.original_action_hash?.toString())}
              <ServiceTypeCard
                {serviceType}
                onEdit={() => handleEdit(serviceType)}
                onDelete={() => {
                  if (serviceType.original_action_hash) {
                    handleDeleteServiceType(serviceType.original_action_hash);
                  }
                }}
                showActions={true}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </section>