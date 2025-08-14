<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import type { UIServiceType } from '$lib/types/ui';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { runEffect } from '$lib/utils/effect';
  import { untrack } from 'svelte';

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


  // Filter service types based on search
  $effect(() => {
    let filtered = serviceTypes;

    // Apply text search filter
    if (search) {
      filtered = filtered.filter(
        (serviceType) =>
          serviceType.name.toLowerCase().includes(search.toLowerCase()) ||
          serviceType.description.toLowerCase().includes(search.toLowerCase())
      );
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
    const externalHashes = selectedServiceTypes.map((hash) => hash.toString()).sort();
    const currentHashes = selectedHashes.map((hash) => hash.toString()).sort();

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
        console.warn(
          'Holochain client not connected, service types will load when connection is established'
        );
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

  function handleCheckboxChange(event: Event, serviceType: UIServiceType) {
    const target = event.target as HTMLInputElement;
    const isChecked = target.checked;
    const serviceTypeHash = serviceType.original_action_hash!;
    const hashString = serviceTypeHash.toString();

    if (isChecked) {
      // Add to selection if not already present
      if (!selectedHashes.some((hash) => hash.toString() === hashString)) {
        selectedHashes = [...selectedHashes, serviceTypeHash];
      }
    } else {
      // Remove from selection
      selectedHashes = selectedHashes.filter((hash) => hash.toString() !== hashString);
    }

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
    const technical = serviceType.technical ? ' (Technical)' : ' (Non-Technical)';
    return `${serviceType.name}${technical}`;
  }

  function clearFilters() {
    search = '';
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

    <!-- Clear filters button -->
    {#if search}
      <div class="mb-2 flex justify-end">
        <button
          type="button"
          class="variant-soft-error btn btn-sm"
          onclick={clearFilters}
          title="Clear all filters"
        >
          Clear Filters
        </button>
      </div>
    {/if}

    <!-- Service types checkboxes -->
    {#if loading}
      <div class="card p-4 text-center">
        <div class="loading loading-spinner loading-md mx-auto mb-2"></div>
        <p class="text-sm">Loading service types...</p>
      </div>
    {:else if error}
      <div class="alert variant-filled-error">
        <div class="alert-message">
          <h3 class="h3">Error</h3>
          <p>{error}</p>
        </div>
      </div>
    {:else if filteredServiceTypes.length === 0}
      <div class="card p-4 text-center">
        <div class="mb-2 text-surface-500">
          <span class="text-2xl">🔍</span>
        </div>
        {#if search}
          <p class="text-sm">No service types found for "{search}"</p>
        {:else if serviceTypes.length === 0}
          <p class="text-sm">No service types available</p>
        {:else}
          <p class="text-sm">No service types match your search</p>
        {/if}
      </div>
    {:else}
      <div class="card p-3">
        <h4 class="h4 mb-3 flex items-center gap-2">
          <span class="text-lg">🔧</span>
          Available Service Types
          {#if filteredServiceTypes.length !== serviceTypes.length}
            <span class="variant-soft-secondary badge text-xs">
              {filteredServiceTypes.length} of {serviceTypes.length}
            </span>
          {/if}
        </h4>
        <div class="max-h-80 space-y-2 overflow-y-auto">
          {#each filteredServiceTypes as serviceType}
            {@const isSelected = selectedHashes.some(
              (hash) => hash.toString() === serviceType.original_action_hash?.toString()
            )}
            <label class="label flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                class="checkbox"
                {disabled}
                checked={isSelected}
                onchange={(e) => handleCheckboxChange(e, serviceType)}
              />
              <div class="flex-1 space-y-1">
                <div class="text-sm font-medium">{serviceType.name}</div>
                {#if serviceType.description}
                  <div class="text-xs text-surface-500">{serviceType.description}</div>
                {/if}
                <div class="flex flex-wrap gap-1">
                  <span class="variant-soft-{serviceType.technical ? 'primary' : 'secondary'} badge text-xs">
                    {serviceType.technical ? 'Technical' : 'Non-Technical'}
                  </span>
                </div>
              </div>
            </label>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Help text -->
    {#if !disabled && !loading && !error && filteredServiceTypes.length > 0}
      <div class="mt-3 text-sm text-surface-500">
        <div class="mb-1">
          🔧 <strong>Service Types:</strong> Check boxes to select the services you offer or need
        </div>
        <div class="text-xs text-surface-400">
          Use search and tag filters to find specific service types more easily
        </div>
      </div>
    {/if}
  </label>
</div>
