<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import type { UIServiceType } from '$lib/types/ui';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { Effect as E } from 'effect';
  import { getToastStore } from '@skeletonlabs/skeleton';

  type Props = {
    selectedServiceTypes?: ActionHash[];
    onSelectionChange?: (selectedHashes: ActionHash[]) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    maxVisible?: number;
    allowCreate?: boolean;
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
    allowCreate = false,
    name,
    id
  }: Props = $props();

  // Toast store for notifications
  const toastStore = getToastStore();

  // Local state
  let searchTerm = $state('');
  let isDropdownOpen = $state(false);
  let selectedHashes = $state<ActionHash[]>([...selectedServiceTypes]);
  let isCreating = $state(false);
  let newServiceTypeName = $state('');
  let newServiceTypeDescription = $state('');
  let showCreateForm = $state(false);

  // Reactive computed values
  const serviceTypes = $derived(serviceTypesStore.serviceTypes);
  const loading = $derived(serviceTypesStore.loading);
  const error = $derived(serviceTypesStore.error);

  // Filter service types based on search term
  const filteredServiceTypes = $derived(
    serviceTypes.filter(
      (serviceType: UIServiceType) =>
        serviceType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        serviceType.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        serviceType.tags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  );

  // Get selected service type objects
  const selectedServiceTypeObjects = $derived(
    serviceTypes.filter((serviceType: UIServiceType) =>
      selectedHashes.some(
        (hash) => hash.toString() === serviceType.original_action_hash?.toString()
      )
    )
  );

  // Visible selected service types (for display)
  const visibleSelectedServiceTypes = $derived(selectedServiceTypeObjects.slice(0, maxVisible));

  const hiddenSelectedCount = $derived(Math.max(0, selectedServiceTypeObjects.length - maxVisible));

  // Load service types on component mount
  $effect(() => {
    loadServiceTypes();
  });

  // Sync external selection changes
  $effect(() => {
    selectedHashes = [...selectedServiceTypes];
  });

  // Notify parent of selection changes
  $effect(() => {
    onSelectionChange(selectedHashes);
  });

  async function loadServiceTypes() {
    try {
      // Load all service types
      await E.runPromise(serviceTypesStore.getAllServiceTypes());
      
      // Check if service types exist
      if (serviceTypes.length === 0) {
        console.warn('No service types available');
      }
    } catch (error) {
      console.error('Failed to load service types:', error);
      toastStore.trigger({
        message: 'Failed to load service types',
        background: 'variant-filled-error'
      });
    }
  }

  function toggleServiceType(serviceTypeHash: ActionHash) {
    const hashString = serviceTypeHash.toString();
    const isSelected = selectedHashes.some((hash) => hash.toString() === hashString);

    if (isSelected) {
      selectedHashes = selectedHashes.filter((hash) => hash.toString() !== hashString);
    } else {
      selectedHashes = [...selectedHashes, serviceTypeHash];
    }
  }

  function removeServiceType(serviceTypeHash: ActionHash) {
    const hashString = serviceTypeHash.toString();
    selectedHashes = selectedHashes.filter((hash) => hash.toString() !== hashString);
  }

  function clearSelection() {
    selectedHashes = [];
  }

  function handleSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    searchTerm = target.value;
  }

  function openDropdown() {
    if (!disabled) {
      isDropdownOpen = true;
    }
  }

  function closeDropdown() {
    isDropdownOpen = false;
    searchTerm = '';
    showCreateForm = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeDropdown();
    }
  }

  async function createNewServiceType() {
    if (!newServiceTypeName.trim() || !newServiceTypeDescription.trim()) {
      toastStore.trigger({
        message: 'Name and description are required',
        background: 'variant-filled-error'
      });
      return;
    }

    isCreating = true;

    try {
      const record = await E.runPromise(
        serviceTypesStore.createServiceType({
          name: newServiceTypeName.trim(),
          description: newServiceTypeDescription.trim(),
          tags: []
        })
      );

      // Add the new service type to selection
      if (record && record.signed_action && record.signed_action.hashed) {
        selectedHashes = [...selectedHashes, record.signed_action.hashed.hash];
      }

      // Reset form
      newServiceTypeName = '';
      newServiceTypeDescription = '';
      showCreateForm = false;
      searchTerm = '';

      toastStore.trigger({
        message: 'Service type created successfully',
        background: 'variant-filled-success'
      });
    } catch (error) {
      console.error('Failed to create service type:', error);
      toastStore.trigger({
        message: 'Failed to create service type',
        background: 'variant-filled-error'
      });
    } finally {
      isCreating = false;
    }
  }

  function toggleCreateForm() {
    showCreateForm = !showCreateForm;
    if (showCreateForm) {
      newServiceTypeName = searchTerm;
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="relative">
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
    <div class="relative">
      <input
        type="text"
        {placeholder}
        {name}
        {id}
        {disabled}
        class="input w-full"
        class:cursor-not-allowed={disabled}
        value={searchTerm}
        oninput={handleSearchInput}
        onfocus={openDropdown}
        autocomplete="off"
      />

      {#if loading}
        <div class="absolute right-3 top-1/2 -translate-y-1/2 transform">
          <div class="border-primary-500 h-4 w-4 animate-spin rounded-full border-b-2"></div>
        </div>
      {/if}
    </div>

    <!-- Dropdown -->
    {#if isDropdownOpen && !disabled}
      <div
        class="bg-surface-100-800-token border-surface-300-600-token absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border shadow-lg"
      >
        {#if error}
          <div class="text-error-500 p-3 text-sm">
            Error loading service types: {error}
          </div>
        {:else if loading}
          <div class="text-surface-500 flex items-center gap-2 p-3 text-sm">
            <div class="border-primary-500 h-4 w-4 animate-spin rounded-full border-b-2"></div>
            Loading service types...
          </div>
        {:else if filteredServiceTypes.length === 0 && !showCreateForm}
          <div class="p-3">
            {#if searchTerm}
              <div class="text-surface-500 text-sm">
                No service types found for "{searchTerm}"
                {#if allowCreate}
                  <button
                    type="button"
                    class="text-primary-500 hover:text-primary-600 mt-2 block text-sm"
                    onclick={toggleCreateForm}
                  >
                    Create "{searchTerm}" as new service type
                  </button>
                {/if}
              </div>
            {:else if serviceTypes.length === 0}
              <!-- No service types exist at all - show admin guidance -->
              <div class="alert variant-filled-warning mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div>
                  <h3 class="font-bold">No Service Types Available</h3>
                  <p class="text-sm">Service types must be created by administrators before they can be used in requests and offers.</p>
                </div>
              </div>
              {#if allowCreate}
                <button
                  type="button"
                  class="btn btn-sm variant-filled-primary w-full"
                  onclick={toggleCreateForm}
                >
                  Create First Service Type
                </button>
              {:else}
                <p class="text-sm text-surface-500 mt-2">Please contact an administrator to create service types.</p>
              {/if}
            {:else}
              <div class="text-surface-500 text-sm">
                No service types available
              </div>
            {/if}
          </div>
        {:else}
          <!-- Service type options -->
          {#each filteredServiceTypes as serviceType}
            {@const isSelected = selectedHashes.some(
              (hash) => hash.toString() === serviceType.original_action_hash?.toString()
            )}
            <button
              type="button"
              class="hover:bg-surface-200-700-token border-surface-200-700-token w-full border-b p-3 text-left last:border-b-0"
              class:bg-primary-100-800-token={isSelected}
              onclick={() => toggleServiceType(serviceType.original_action_hash!)}
            >
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="font-medium">{serviceType.name}</div>
                  <div class="text-surface-600-300-token text-sm">{serviceType.description}</div>
                  {#if serviceType.tags.length > 0}
                    <div class="mt-1 flex flex-wrap gap-1">
                      {#each serviceType.tags as tag}
                        <span class="bg-surface-200-700-token rounded px-1 py-0.5 text-xs">
                          {tag}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </div>
                {#if isSelected}
                  <div class="text-primary-500 ml-2">✓</div>
                {/if}
              </div>
            </button>
          {/each}

          <!-- Create new service type form -->
          {#if allowCreate && (showCreateForm || (filteredServiceTypes.length === 0 && searchTerm))}
            <div class="border-surface-200-700-token bg-surface-50-900-token border-t p-3">
              <div class="mb-2 text-sm font-medium">Create New Service Type</div>
              <div class="space-y-2">
                <input
                  type="text"
                  placeholder="Service type name"
                  class="input input-sm w-full"
                  bind:value={newServiceTypeName}
                  disabled={isCreating}
                />
                <textarea
                  placeholder="Description"
                  class="textarea textarea-sm w-full"
                  rows="2"
                  bind:value={newServiceTypeDescription}
                  disabled={isCreating}
                ></textarea>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="btn btn-sm variant-filled-primary"
                    onclick={createNewServiceType}
                    disabled={isCreating ||
                      !newServiceTypeName.trim() ||
                      !newServiceTypeDescription.trim()}
                  >
                    {#if isCreating}
                      <div
                        class="mr-1 h-3 w-3 animate-spin rounded-full border-b-2 border-white"
                      ></div>
                    {/if}
                    Create
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm variant-soft"
                    onclick={toggleCreateForm}
                    disabled={isCreating}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          {/if}
        {/if}

        <!-- Close dropdown button -->
        <div class="border-surface-200-700-token border-t p-2">
          <button type="button" class="btn btn-sm variant-soft w-full" onclick={closeDropdown}>
            Close
          </button>
        </div>
      </div>
    {/if}
  </label>

  <!-- Click outside to close dropdown -->
  {#if isDropdownOpen}
    <button
      class="fixed inset-0 z-40"
      onclick={closeDropdown}
      tabindex="-1"
      aria-label="Close dropdown"
    ></button>
  {/if}
</div>
