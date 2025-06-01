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
    id
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
  let isInternalUpdate = $state(false); // Flag to prevent loops

  // Filter service types based on search
  $effect(() => {
    if (!search) {
      filteredServiceTypes = serviceTypes;
    } else {
      filteredServiceTypes = serviceTypes.filter(
        (serviceType) =>
          serviceType.name.toLowerCase().includes(search.toLowerCase()) ||
          serviceType.description.toLowerCase().includes(search.toLowerCase()) ||
          serviceType.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
      );
    }
  });

  // Load service types on mount
  $effect(() => {
    if (!initialized) {
      loadServiceTypes();
    }
  });

  // Sync external selection changes (INPUT ONLY)
  $effect(() => {
    // Only sync if this is NOT an internal update
    if (!isInternalUpdate) {
      selectedHashes = [...selectedServiceTypes];
    }
  });

  // Notify parent of selection changes (OUTPUT ONLY)
  $effect(() => {
    // Use untrack to prevent this effect from depending on external props
    untrack(() => {
      // Only notify if this IS an internal update
      if (isInternalUpdate) {
        onSelectionChange(selectedHashes);
        isInternalUpdate = false; // Reset flag
      }
    });
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
      await runEffect(serviceTypesStore.getAllServiceTypes());
      serviceTypes = serviceTypesStore.serviceTypes;
      initialized = true;
    } catch (err) {
      console.error('Failed to load service types:', err);
      error = 'Failed to load service types';
      toastStore.trigger({
        message: 'Failed to load service types',
        background: 'variant-filled-error'
      });
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

    // Set flag to indicate this is an internal update
    isInternalUpdate = true;

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
  }

  function removeServiceType(serviceTypeHash: ActionHash) {
    const hashString = serviceTypeHash.toString();
    isInternalUpdate = true; // Set flag for internal update
    selectedHashes = selectedHashes.filter((hash) => hash.toString() !== hashString);
  }

  function clearSelection() {
    isInternalUpdate = true; // Set flag for internal update
    selectedHashes = [];
  }

  function getServiceTypeDisplay(serviceType: UIServiceType): string {
    const tags = serviceType.tags.length > 0 ? ` (${serviceType.tags.join(', ')})` : '';
    return `${serviceType.name}${tags}`;
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
