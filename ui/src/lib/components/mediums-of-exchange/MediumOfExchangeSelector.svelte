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
  let currenciesCollapsed = $state(true); // Currencies section collapsed by default

  // Filter mediums based on search and group by type
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

    // Sort by exchange_type (base first) then by name
    filtered.sort((a, b) => {
      if (a.exchange_type !== b.exchange_type) {
        return a.exchange_type === 'base' ? -1 : 1; // Base first
      }
      return a.name.localeCompare(b.name);
    });

    filteredMediums = filtered;
  });

  // Auto-selection logic is disabled for the new hybrid UI since it's now primarily multiple-selection
  // Users will explicitly choose base categories via checkboxes and currencies via multi-select

  // Auto-expand currencies section when currencies are selected
  $effect(() => {
    if (hasCurrencySelection() && currenciesCollapsed) {
      currenciesCollapsed = false;
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

  // Group filtered mediums by exchange_type for display
  const groupedMediums = $derived(() => {
    const base = filteredMediums.filter((m) => m.exchange_type === 'base');
    const currency = filteredMediums.filter((m) => m.exchange_type === 'currency');
    return { base, currency };
  });

  // Check if any currencies are currently selected
  const hasCurrencySelection = $derived(() => {
    return selectedHashes.some((hash) => {
      const medium = mediums.find((m) => m.actionHash?.toString() === hash.toString());
      return medium?.exchange_type === 'currency';
    });
  });

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

  function handleBaseCheckboxChange(event: Event, medium: UIMediumOfExchange) {
    const target = event.target as HTMLInputElement;
    const isChecked = target.checked;
    const mediumHash = medium.actionHash!;
    const hashString = mediumHash.toString();

    if (isChecked) {
      // Add to selection if not already present
      if (!selectedHashes.some((hash) => hash.toString() === hashString)) {
        selectedHashes = [...selectedHashes, mediumHash];
      }
    } else {
      // Remove from selection
      selectedHashes = selectedHashes.filter((hash) => hash.toString() !== hashString);
    }

    // Reset auto-selection tracking when user manually selects
    lastAutoSelectedHash = null;

    // Notify parent of the change
    onSelectionChange(selectedHashes);
  }

  function handleCurrencyCheckboxChange(event: Event, medium: UIMediumOfExchange) {
    const target = event.target as HTMLInputElement;
    const isChecked = target.checked;
    const mediumHash = medium.actionHash!;
    const hashString = mediumHash.toString();

    if (isChecked) {
      // Add to selection if not already present
      if (!selectedHashes.some((hash) => hash.toString() === hashString)) {
        selectedHashes = [...selectedHashes, mediumHash];
      }
    } else {
      // Remove from selection
      selectedHashes = selectedHashes.filter((hash) => hash.toString() !== hashString);
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
    const typeIcon = medium.exchange_type === 'base' ? '📂' : '💰';
    return `${typeIcon} ${medium.code} - ${medium.name}`;
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

    <!-- Base Categories (Checkboxes) -->
    {#if !loading && !error && groupedMediums().base.length > 0}
      <div class="space-y-3">
        <div class="card p-3">
          <h4 class="h4 mb-3 flex items-center gap-2">
            <span class="text-lg">📂</span>
            Base Categories
          </h4>
          <div class="space-y-2">
            {#each groupedMediums().base as medium}
              {@const isSelected = selectedHashes.some(
                (hash) => hash.toString() === medium.actionHash?.toString()
              )}
              <label class="label flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  class="checkbox"
                  {disabled}
                  checked={isSelected}
                  onchange={(e) => handleBaseCheckboxChange(e, medium)}
                />
                <div class="space-y-0">
                  <div class="text-sm font-medium">{medium.name}</div>
                  {#if medium.description}
                    <div class="text-xs text-surface-500">{medium.description}</div>
                  {/if}
                </div>
              </label>
            {/each}
          </div>
        </div>

        <!-- Currencies Select -->
        {#if groupedMediums().currency.length > 0}
          <div class="card p-3" class:opacity-60={currenciesCollapsed}>
            <div class="mb-3 flex items-center justify-between">
              <h4 class="h4 flex items-center gap-2">
                <span class="text-lg">💰</span>
                Currencies
                {#if hasCurrencySelection()}
                  <span class="variant-soft-primary badge text-xs">
                    {selectedHashes.filter((hash) => {
                      const medium = mediums.find(
                        (m) => m.actionHash?.toString() === hash.toString()
                      );
                      return medium?.exchange_type === 'currency';
                    }).length} selected
                  </span>
                {/if}
              </h4>
              <button
                type="button"
                class="btn btn-sm"
                class:variant-ghost-primary={!hasCurrencySelection()}
                class:variant-soft-surface={hasCurrencySelection()}
                class:cursor-not-allowed={hasCurrencySelection()}
                onclick={() => {
                  if (!hasCurrencySelection()) {
                    currenciesCollapsed = !currenciesCollapsed;
                  }
                }}
                disabled={disabled || hasCurrencySelection()}
                title={hasCurrencySelection()
                  ? 'Cannot hide currencies while some are selected'
                  : `${currenciesCollapsed ? 'Show' : 'Hide'} currencies`}
              >
                {currenciesCollapsed ? 'Show' : 'Hide'}
                <span class="ml-1">
                  {currenciesCollapsed ? '▼' : '▲'}
                </span>
              </button>
            </div>

            {#if !currenciesCollapsed}
              <div class="space-y-2">
                {#each groupedMediums().currency as medium}
                  {@const isSelected = selectedHashes.some(
                    (hash) => hash.toString() === medium.actionHash?.toString()
                  )}
                  <label class="label flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      class="checkbox"
                      {disabled}
                      checked={isSelected}
                      onchange={(e) => handleCurrencyCheckboxChange(e, medium)}
                    />
                    <div class="space-y-0">
                      <div class="text-sm font-medium">{medium.name}</div>
                      {#if medium.description}
                        <div class="text-xs text-surface-500">{medium.description}</div>
                      {/if}
                    </div>
                  </label>
                {/each}
              </div>
              {#if hasCurrencySelection()}
                <div class="mt-2 text-xs italic text-surface-400">
                  💡 This section stays open while currencies are selected
                </div>
              {/if}
            {:else}
              <div class="text-sm italic text-surface-500">
                {groupedMediums().currency.length} currencies available (click Show to expand)
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else if loading}
      <div class="card p-4 text-center">
        <div class="loading loading-spinner loading-md mx-auto mb-2"></div>
        <p class="text-sm">Loading mediums of exchange...</p>
      </div>
    {:else if error}
      <div class="alert variant-filled-error">
        <div class="alert-message">
          <h3 class="h3">Error</h3>
          <p>{error}</p>
        </div>
      </div>
    {:else if filteredMediums.length === 0}
      <div class="card p-4 text-center">
        <div class="mb-2 text-surface-500">
          <span class="text-2xl">🔍</span>
        </div>
        {#if search}
          <p class="text-sm">No mediums found for "{search}"</p>
        {:else if mediums.length === 0}
          <p class="text-sm">No mediums of exchange available</p>
        {:else}
          <p class="text-sm">No mediums match your search</p>
        {/if}
      </div>
    {/if}

    <!-- Help text -->
    {#if !disabled && !loading && !error && (groupedMediums().base.length > 0 || groupedMediums().currency.length > 0)}
      <div class="mt-3 text-sm text-surface-500">
        <div class="mb-1">
          📂 <strong>Base Categories:</strong> Check boxes to select foundational exchange types
        </div>
        <div class="text-xs text-surface-500">
          💰 <strong>Currencies:</strong> Check boxes to select specific monetary units (currencies section
          collapsed by default)
        </div>
      </div>
    {/if}
  </label>
</div>
