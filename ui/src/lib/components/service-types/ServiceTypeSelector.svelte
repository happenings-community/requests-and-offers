<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import type { UIServiceType } from '$lib/types/ui';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { runEffect } from '$lib/utils/effect';
  import { untrack } from 'svelte';
  import TagAutocomplete from '$lib/components/shared/TagAutocomplete.svelte';

  type Props = {
    selectedServiceTypes?: ActionHash[];
    onSelectionChange?: (selectedHashes: ActionHash[]) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    maxVisible?: number;
    name?: string;
    id?: string;
    enableTagFiltering?: boolean;
    tagFilterMode?: 'any' | 'all'; // 'any' = OR logic, 'all' = AND logic
  };

  const {
    selectedServiceTypes = [],
    onSelectionChange = () => {},
    label = 'Service Types',
    placeholder = 'Search service types...',
    required = false,
    disabled = false,
    maxVisible = 5,
    name,
    id,
    enableTagFiltering = false,
    tagFilterMode: initialTagFilterMode = 'any'
  }: Props = $props();

  // Toast store for notifications
  const toastStore = getToastStore();

  // State
  let serviceTypes: UIServiceType[] = $state([]);
  let filteredServiceTypes: UIServiceType[] = $state([]);
  let search = $state('');
  let selectedHashes = $state<ActionHash[]>([...selectedServiceTypes]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let initialized = $state(false);
  
  // Tag filtering state
  let selectedFilterTags = $state<string[]>([]);
  let showAdvancedFilters = $state(false);
  let tagFilterMode = $state<'any' | 'all'>(initialTagFilterMode);

  // Filter service types based on search and tags
  $effect(() => {
    let filtered = serviceTypes;

    // Apply text search filter
    if (search) {
      filtered = filtered.filter(
        (serviceType) =>
          serviceType.name.toLowerCase().includes(search.toLowerCase()) ||
          serviceType.description.toLowerCase().includes(search.toLowerCase()) ||
          serviceType.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // Apply tag filter
    if (enableTagFiltering && selectedFilterTags.length > 0) {
      filtered = filtered.filter((serviceType) => {
        if (tagFilterMode === 'all') {
          // AND logic: service type must have ALL selected tags
          return selectedFilterTags.every(filterTag => 
            serviceType.tags.some(tag => tag.toLowerCase() === filterTag.toLowerCase())
          );
        } else {
          // OR logic: service type must have ANY of the selected tags
          return selectedFilterTags.some(filterTag => 
            serviceType.tags.some(tag => tag.toLowerCase() === filterTag.toLowerCase())
          );
        }
      });
    }

    filteredServiceTypes = filtered;
  });

  // Load service types on mount
  $effect(() => {
    if (!initialized) {
      loadServiceTypes();
    }
  });

  // Sync external selection changes to internal state
  $effect(() => {
    // Only update if the external prop has actually changed
    const externalHashes = selectedServiceTypes.map(hash => hash.toString()).sort();
    const currentHashes = selectedHashes.map(hash => hash.toString()).sort();
    
    if (JSON.stringify(externalHashes) !== JSON.stringify(currentHashes)) {
      selectedHashes = [...selectedServiceTypes];
    }
  });

  // Get selected service type objects for display
  const selectedServiceTypeObjects = $derived(
    serviceTypes.filter((serviceType) =>
      selectedHashes.some(
        (hash) => hash.toString() === serviceType.original_action_hash?.toString()
      )
    )
  );

  // Visible selected service types (for display)
  const visibleSelectedServiceTypes = $derived(selectedServiceTypeObjects.slice(0, maxVisible));
  const hiddenSelectedCount = $derived(Math.max(0, selectedServiceTypeObjects.length - maxVisible));

  async function loadServiceTypes() {
    if (initialized) return;

    loading = true;
    error = null;

    try {
      await runEffect(serviceTypesStore.getApprovedServiceTypes());
      serviceTypes = serviceTypesStore.approvedServiceTypes;
      initialized = true;
    } catch (err) {
      const errorMessage = String(err);
      
      // Handle connection errors gracefully without showing toast
      if (errorMessage.includes('Client not connected')) {
        console.warn('Holochain client not connected, service types will load when connection is established');
        error = null; // Don't show error state for connection issues
      } else {
        console.error('Failed to load service types:', err);
        error = 'Failed to load service types';
        toastStore.trigger({
          message: 'Failed to load service types',
          background: 'variant-filled-error'
        });
      }
    } finally {
      loading = false;
    }
  }

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    search = target.value.trim();
  }

  function handleSelectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const selectedOptions = Array.from(target.selectedOptions);

    selectedHashes = selectedOptions
      .map((option) => option.value)
      .filter((value) => value) // Remove empty values
      .map((hashString) => {
        // Find the service type and return its action hash
        const serviceType = serviceTypes.find(
          (st) => st.original_action_hash?.toString() === hashString
        );
        return serviceType?.original_action_hash!;
      })
      .filter(Boolean); // Remove undefined values
    
    // Notify parent of the change
    onSelectionChange(selectedHashes);
  }

  function removeServiceType(serviceTypeHash: ActionHash) {
    const hashString = serviceTypeHash.toString();
    selectedHashes = selectedHashes.filter((hash) => hash.toString() !== hashString);
    
    // Notify parent of the change
    onSelectionChange(selectedHashes);
  }

  function clearSelection() {
    selectedHashes = [];
    
    // Notify parent of the change
    onSelectionChange(selectedHashes);
  }

  function getServiceTypeDisplay(serviceType: UIServiceType): string {
    const tags = serviceType.tags.length > 0 ? ` (${serviceType.tags.join(', ')})` : '';
    return `${serviceType.name}${tags}`;
  }

  function handleTagFilterChange(tags: string[]) {
    selectedFilterTags = tags;
  }

  function clearFilters() {
    selectedFilterTags = [];
    search = '';
  }

  function toggleAdvancedFilters() {
    showAdvancedFilters = !showAdvancedFilters;
  }
</script>

<div class="space-y-2">
  <label class="label">
    {label} <span class="text-error-500">{required ? '*' : ''}</span>

    <!-- Selected service types display -->
    {#if selectedServiceTypeObjects.length > 0}
      <div class="mb-2 flex flex-wrap items-center gap-2">
        {#each visibleSelectedServiceTypes as serviceType}
          <span class="variant-soft-primary chip">
            {serviceType.name}
            {#if !disabled}
              <button
                type="button"
                class="ml-1 text-xs opacity-70 hover:opacity-100"
                onclick={() => removeServiceType(serviceType.original_action_hash!)}
                title="Remove {serviceType.name}"
              >
                ×
              </button>
            {/if}
          </span>
        {/each}

        {#if hiddenSelectedCount > 0}
          <span class="variant-soft-secondary chip">
            +{hiddenSelectedCount} more
          </span>
        {/if}

        {#if !disabled && selectedServiceTypeObjects.length > 0}
          <button
            type="button"
            class="variant-soft-error chip text-xs"
            onclick={clearSelection}
            title="Clear all selections"
          >
            Clear all
          </button>
        {/if}
      </div>
    {/if}

    <!-- Search input -->
    <input
      type="text"
      {placeholder}
      class="input mb-2 w-full"
      {disabled}
      oninput={handleSearchInput}
      value={search}
    />

    <!-- Advanced filters toggle -->
    {#if enableTagFiltering}
      <div class="flex items-center justify-between mb-2">
        <button
          type="button"
          class="btn btn-sm variant-ghost-surface"
          onclick={toggleAdvancedFilters}
        >
          <span class="text-sm">
            {showAdvancedFilters ? 'Hide' : 'Show'} Tag Filters
          </span>
          <span class="ml-1 text-xs">
            {showAdvancedFilters ? '▲' : '▼'}
          </span>
        </button>
        
        {#if selectedFilterTags.length > 0 || search}
          <button
            type="button"
            class="btn btn-sm variant-soft-error"
            onclick={clearFilters}
            title="Clear all filters"
          >
            Clear Filters
          </button>
        {/if}
      </div>

      <!-- Tag filtering section -->
      {#if showAdvancedFilters}
        <div class="space-y-3 mb-3 p-3 bg-surface-50-900-token rounded-md border border-surface-300-600-token">
          <TagAutocomplete
            selectedTags={selectedFilterTags}
            onTagsChange={handleTagFilterChange}
            label="Filter by Tags"
            placeholder="Search tags to filter by..."
            allowCustomTags={false}
            disabled={disabled}
          />
          
          {#if selectedFilterTags.length > 0}
            <div class="flex items-center gap-2">
              <span class="text-sm text-surface-600-300-token">Filter mode:</span>
              <label class="flex items-center gap-1">
                <input
                  type="radio"
                  bind:group={tagFilterMode}
                  value="any"
                  class="radio"
                  {disabled}
                />
                <span class="text-sm">Any tag (OR)</span>
              </label>
              <label class="flex items-center gap-1">
                <input
                  type="radio"
                  bind:group={tagFilterMode}
                  value="all"
                  class="radio"
                  {disabled}
                />
                <span class="text-sm">All tags (AND)</span>
              </label>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Service types select -->
    <select
      {name}
      {id}
      class="select w-full"
      class:cursor-not-allowed={disabled}
      {disabled}
      {required}
      multiple
      size="6"
      onchange={handleSelectionChange}
    >
      {#if loading}
        <option disabled>Loading service types...</option>
      {:else if error}
        <option disabled>Error: {error}</option>
      {:else if filteredServiceTypes.length === 0}
        {#if search}
          <option disabled>No service types found for "{search}"</option>
        {:else if serviceTypes.length === 0}
          <option disabled>No service types available</option>
        {:else}
          <option disabled>No service types match your search</option>
        {/if}
      {:else}
        {#each filteredServiceTypes as serviceType}
          {@const isSelected = selectedHashes.some(
            (hash) => hash.toString() === serviceType.original_action_hash?.toString()
          )}
          <option value={serviceType.original_action_hash?.toString()} selected={isSelected}>
            {getServiceTypeDisplay(serviceType)}
          </option>
        {/each}
      {/if}
    </select>

    <!-- Help text -->
    {#if !disabled}
      <div class="text-surface-500 mt-1 text-sm">
        Hold Ctrl/Cmd to select multiple service types
      </div>
    {/if}
  </label>
</div>
