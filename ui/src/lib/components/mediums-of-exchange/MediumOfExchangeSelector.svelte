<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { runEffect } from '$lib/utils/effect';

  type Props = {
    selectedMediums?: ActionHash[];
    onSelectionChange?: (selectedHashes: ActionHash[]) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    maxVisible?: number;
    name?: string;
    id?: string;
    mode?: 'single' | 'multiple';
  };

  const {
    selectedMediums = [],
    onSelectionChange = () => {},
    label = 'Medium of Exchange',
    placeholder = 'Search mediums of exchange...',
    required = false,
    disabled = false,
    maxVisible = 5,
    name,
    id,
    mode = 'single'
  }: Props = $props();

  // Toast store for notifications
  const toastStore = getToastStore();

  // State
  let mediums: UIMediumOfExchange[] = $state([]);
  let filteredMediums: UIMediumOfExchange[] = $state([]);
  let search = $state('');
  let selectedHashes = $state<ActionHash[]>([...selectedMediums]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let initialized = $state(false);
  let lastAutoSelectedHash = $state<string | null>(null); // Track last auto-selection to prevent loops

  // Filter mediums based on search (separate from auto-selection)
  $effect(() => {
    let filtered = mediums;

    // Apply text search filter
    if (search) {
      filtered = filtered.filter(
        (medium) =>
          medium.name.toLowerCase().includes(search.toLowerCase()) ||
          medium.code.toLowerCase().includes(search.toLowerCase())
      );
    }

    filteredMediums = filtered;
  });

  // Auto-selection logic (separate effect to avoid loops)
  $effect(() => {
    if (mode !== 'single' || disabled) return;

    let shouldAutoSelect = false;
    let targetMedium: UIMediumOfExchange | null = null;

    // Case 1: Searching and have filtered results
    if (search && filteredMediums.length > 0) {
      targetMedium = filteredMediums[0];
      shouldAutoSelect = true;
    }
    // Case 2: No search, no current selection, and have options
    else if (!search && selectedHashes.length === 0 && filteredMediums.length > 0) {
      targetMedium = filteredMediums[0];
      shouldAutoSelect = true;
    }

    // Only auto-select if we have a target and it's different from last auto-selection
    if (shouldAutoSelect && targetMedium?.actionHash) {
      const targetHashString = targetMedium.actionHash.toString();

      // Prevent loop: only auto-select if it's different from current selection
      const currentHashString = selectedHashes[0]?.toString();

      if (targetHashString !== currentHashString && targetHashString !== lastAutoSelectedHash) {
        lastAutoSelectedHash = targetHashString;
        selectedHashes = [targetMedium.actionHash];
        onSelectionChange(selectedHashes);
      }
    }
  });

  // Load mediums on mount
  $effect(() => {
    if (!initialized) {
      loadMediums();
    }
  });

  // Sync external selection changes to internal state
  $effect(() => {
    // Only update if the external prop has actually changed
    const externalHashes = selectedMediums.map((hash) => hash.toString()).sort();
    const currentHashes = selectedHashes.map((hash) => hash.toString()).sort();

    if (JSON.stringify(externalHashes) !== JSON.stringify(currentHashes)) {
      selectedHashes = [...selectedMediums];
      // Reset auto-selection tracking when external change occurs
      lastAutoSelectedHash = null;
    }
  });

  // Get selected medium objects for display
  const selectedMediumObjects = $derived(
    mediums.filter((medium) =>
      selectedHashes.some((hash) => hash.toString() === medium.actionHash?.toString())
    )
  );

  // Visible selected mediums (for display)
  const visibleSelectedMediums = $derived(selectedMediumObjects.slice(0, maxVisible));
  const hiddenSelectedCount = $derived(Math.max(0, selectedMediumObjects.length - maxVisible));

  async function loadMediums() {
    if (initialized) return;

    loading = true;
    error = null;

    try {
      await runEffect(mediumsOfExchangeStore.getApprovedMediumsOfExchange());
      mediums = mediumsOfExchangeStore.approvedMediumsOfExchange;
      initialized = true;
    } catch (err) {
      const errorMessage = String(err);

      // Handle connection errors gracefully without showing toast
      if (errorMessage.includes('Client not connected')) {
        console.warn(
          'Holochain client not connected, mediums of exchange will load when connection is established'
        );
        error = null; // Don't show error state for connection issues
      } else {
        console.error('Failed to load mediums of exchange:', err);
        error = 'Failed to load mediums of exchange';
        toastStore.trigger({
          message: 'Failed to load mediums of exchange',
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
    // Reset auto-selection tracking when user manually searches
    lastAutoSelectedHash = null;
  }

  function handleSelectionChange(event: Event) {
    const target = event.target as HTMLSelectElement;

    if (mode === 'single') {
      // Single selection mode
      const selectedValue = target.value;
      if (selectedValue) {
        const medium = mediums.find((m) => m.actionHash?.toString() === selectedValue);
        selectedHashes = medium?.actionHash ? [medium.actionHash] : [];
      } else {
        selectedHashes = [];
      }
    } else {
      // Multiple selection mode
      const selectedOptions = Array.from(target.selectedOptions);
      selectedHashes = selectedOptions
        .map((option) => option.value)
        .filter((value) => value) // Remove empty values
        .map((hashString) => {
          // Find the medium and return its action hash
          const medium = mediums.find((m) => m.actionHash?.toString() === hashString);
          return medium?.actionHash!;
        })
        .filter(Boolean); // Remove undefined values
    }

    // Reset auto-selection tracking when user manually selects
    lastAutoSelectedHash = null;

    // Notify parent of the change
    onSelectionChange(selectedHashes);
  }

  function removeMedium(mediumHash: ActionHash) {
    const hashString = mediumHash.toString();
    selectedHashes = selectedHashes.filter((hash) => hash.toString() !== hashString);

    // Reset auto-selection tracking when user manually removes
    lastAutoSelectedHash = null;

    // Notify parent of the change
    onSelectionChange(selectedHashes);
  }

  function clearSelection() {
    selectedHashes = [];

    // Reset auto-selection tracking when user manually clears
    lastAutoSelectedHash = null;

    // Notify parent of the change
    onSelectionChange(selectedHashes);
  }

  function getMediumDisplay(medium: UIMediumOfExchange): string {
    return `${medium.code} - ${medium.name}`;
  }
</script>

<div class="space-y-2">
  <label class="label">
    {label} <span class="text-error-500">{required ? '*' : ''}</span>

    <!-- Selected mediums display (only for multiple mode) -->
    {#if mode === 'multiple' && selectedMediumObjects.length > 0}
      <div class="mb-2 flex flex-wrap items-center gap-2">
        {#each visibleSelectedMediums as medium}
          <span class="variant-soft-primary chip">
            {getMediumDisplay(medium)}
            {#if !disabled}
              <button
                type="button"
                class="ml-1 text-xs opacity-70 hover:opacity-100"
                onclick={() => removeMedium(medium.actionHash!)}
                title="Remove {medium.name}"
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

        {#if !disabled && selectedMediumObjects.length > 0}
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
      bind:value={search}
    />

    <!-- Mediums select -->
    <select
      {name}
      {id}
      class="select w-full"
      class:cursor-not-allowed={disabled}
      {disabled}
      {required}
      multiple={mode === 'multiple'}
      size={mode === 'multiple' ? 6 : undefined}
      onchange={handleSelectionChange}
    >
      {#if loading}
        <option disabled>Loading mediums of exchange...</option>
      {:else if error}
        <option disabled>Error: {error}</option>
      {:else if filteredMediums.length === 0}
        {#if search}
          <option disabled>No mediums found for "{search}"</option>
        {:else if mediums.length === 0}
          <option disabled>No mediums of exchange available</option>
        {:else}
          <option disabled>No mediums match your search</option>
        {/if}
      {:else}
        {#if mode === 'single' && !search}
          <option value="">Select a medium of exchange...</option>
        {/if}
        {#each filteredMediums as medium}
          {@const isSelected = selectedHashes.some(
            (hash) => hash.toString() === medium.actionHash?.toString()
          )}
          <option value={medium.actionHash?.toString()} selected={isSelected}>
            {getMediumDisplay(medium)}
          </option>
        {/each}
      {/if}
    </select>

    <!-- Help text -->
    {#if !disabled}
      <div class="mt-1 text-sm text-surface-500">
        {#if mode === 'multiple'}
          Hold Ctrl/Cmd to select multiple mediums of exchange
        {:else if search && filteredMediums.length > 0}
          Auto-selected: {getMediumDisplay(filteredMediums[0])}
        {:else}
          Type to search and auto-select medium of exchange
        {/if}
      </div>
    {/if}
  </label>
</div>
