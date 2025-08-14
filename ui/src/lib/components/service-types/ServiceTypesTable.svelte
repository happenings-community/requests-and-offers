<script lang="ts">
  import { goto } from '$app/navigation';
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import type { UIServiceType } from '$lib/types/ui';
  import {
    useServiceTypeSorting,
    type ServiceTypeSortField
  } from '$lib/composables/search/useServiceTypeSorting.svelte';

  type Props = {
    serviceTypes: UIServiceType[];
    filteredServiceTypes: UIServiceType[];
    totalFilteredCount: number;
    isLoading: boolean;
    error: string | null;
    onDeleteServiceType: (hash: ActionHash) => void;
    onRetry: () => void;
    enableSorting?: boolean;
    showActions?: boolean;
  };

  const {
    serviceTypes,
    filteredServiceTypes,
    totalFilteredCount,
    isLoading,
    error,
    onDeleteServiceType,
    onRetry,
    enableSorting = false,
    showActions = true
  }: Props = $props();

  // Initialize sorting functionality if enabled
  const sorting = enableSorting ? useServiceTypeSorting('type', 'asc') : undefined;

  // Sort the filtered service types if sorting is enabled
  const sortedServiceTypes = $derived(
    sorting ? sorting.sortServiceTypes(filteredServiceTypes) : filteredServiceTypes
  );

  // Format date for display
  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function handleEdit(serviceType: UIServiceType) {
    if (serviceType.original_action_hash) {
      const encodedHash = encodeHashToBase64(serviceType.original_action_hash);
      goto(`/admin/service-types/${encodedHash}/edit`);
    }
  }

  function handleView(serviceType: UIServiceType) {
    if (serviceType.original_action_hash) {
      const encodedHash = encodeHashToBase64(serviceType.original_action_hash);
      // Navigate to admin view if showActions is true, otherwise public view
      const path = showActions
        ? `/admin/service-types/${encodedHash}`
        : `/service-types/${encodedHash}`;
      goto(path);
    }
  }

  function handleDelete(serviceType: UIServiceType) {
    if (
      serviceType.original_action_hash &&
      confirm('Are you sure you want to delete this service type? This action cannot be undone.')
    ) {
      onDeleteServiceType(serviceType.original_action_hash);
    }
  }

  function handleSort(field: ServiceTypeSortField) {
    if (sorting) {
      sorting.toggleSort(field);
    }
  }
</script>

<!-- Loading State -->
{#if isLoading}
  <div class="flex items-center justify-center space-x-2 p-8 text-center">
    <span class="loading loading-spinner"></span>
    <span>Loading service types...</span>
  </div>

  <!-- Error State -->
{:else if error}
  <div class="alert variant-filled-error">
    <div class="alert-message">
      <h3 class="h3">Error</h3>
      <p>{error}</p>
    </div>
    <div class="alert-actions">
      <button class="btn btn-sm" onclick={onRetry}>Try Again</button>
    </div>
  </div>

  <!-- Content -->
{:else}
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="h2">Service Types ({totalFilteredCount})</h2>
    </div>

    {#if totalFilteredCount === 0}
      <div class="card p-8 text-center">
        <h3 class="h3">No Service Types Found</h3>
        <p class="text-surface-600">
          {#if serviceTypes.length > 0}
            No service types match your current filters.
          {:else}
            No service types have been created yet.
          {/if}
        </p>
        {#if serviceTypes.length === 0}
          <a href="/admin/service-types/create" class="variant-filled-primary btn mt-4">
            Create First Service Type
          </a>
        {/if}
      </div>
    {:else}
      <!-- Table -->
      <div class="border-surface-300-600-token overflow-x-auto border rounded-container-token">
        <table class="w-full">
          <thead>
            <tr>
              <th class="bg-surface-100-800-token text-surface-900-50-token px-4 py-3 font-medium">
                {#if sorting}
                  <button
                    class="flex items-center space-x-1 transition-colors hover:text-primary-600 {sorting.isSortedBy(
                      'name'
                    )
                      ? 'font-semibold text-primary-600'
                      : ''}"
                    onclick={() => handleSort('name')}
                    title="Sort by Name"
                  >
                    <span>Name</span>
                    <span class="text-xs">{sorting.getSortIcon('name')}</span>
                  </button>
                {:else}
                  Name
                {/if}
              </th>
              <th
                class="bg-surface-100-800-token text-surface-900-50-token hidden max-w-[120px] px-4 py-3 font-medium sm:table-cell md:max-w-none"
                >Description</th
              >
              <th class="px-4 py-3 font-medium">
                {#if sorting}
                  <button
                    class="flex items-center space-x-1 transition-colors hover:text-primary-500 {sorting.isSortedBy(
                      'type'
                    )
                      ? 'font-semibold text-primary-400'
                      : ''}"
                    onclick={() => handleSort('type')}
                    title="Sort by Type"
                  >
                    <span>Type</span>
                    <span class="text-xs">{sorting.getSortIcon('type')}</span>
                  </button>
                {:else}
                  Type
                {/if}
              </th>
              <th
                class="bg-surface-100-800-token text-surface-900-50-token hidden px-4 py-3 font-medium md:table-cell"
              >
                {#if sorting}
                  <button
                    class="flex items-center space-x-1 transition-colors hover:text-primary-600 {sorting.isSortedBy(
                      'created_at'
                    )
                      ? 'font-semibold text-primary-600'
                      : ''}"
                    onclick={() => handleSort('created_at')}
                    title="Sort by Created Date"
                  >
                    <span>Created</span>
                    <span class="text-xs">{sorting.getSortIcon('created_at')}</span>
                  </button>
                {:else}
                  Created
                {/if}
              </th>
              <th
                class="bg-surface-100-800-token text-surface-900-50-token hidden px-4 py-3 font-medium md:table-cell"
              >
                {#if sorting}
                  <button
                    class="flex items-center space-x-1 transition-colors hover:text-primary-600 {sorting.isSortedBy(
                      'updated_at'
                    )
                      ? 'font-semibold text-primary-600'
                      : ''}"
                    onclick={() => handleSort('updated_at')}
                    title="Sort by Updated Date"
                  >
                    <span>Updated</span>
                    <span class="text-xs">{sorting.getSortIcon('updated_at')}</span>
                  </button>
                {:else}
                  Updated
                {/if}
              </th>
              {#if showActions}
                <th
                  class="bg-surface-100-800-token text-surface-900-50-token px-4 py-3 text-center font-medium"
                  >Actions</th
                >
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each sortedServiceTypes as serviceType (serviceType.original_action_hash?.toString() || `${serviceType.name}-${serviceType.description.slice(0, 10)}`)}
              <tr class="cursor-pointer hover:bg-surface-50-900-token hover:opacity-50">
                <td class="border-surface-200-700-token border-t px-4 py-3 font-medium">
                  <button
                    class="text-left transition-colors hover:text-primary-600"
                    onclick={() => handleView(serviceType)}
                  >
                    {serviceType.name}
                  </button>
                </td>
                <td
                  class="border-surface-200-700-token hidden max-w-xs border-t px-4 py-3 sm:table-cell md:max-w-xs"
                >
                  <p
                    class="truncate text-surface-600 dark:text-surface-400"
                    title={serviceType.description}
                  >
                    {serviceType.description}
                  </p>
                </td>
                <td class="border-surface-200-700-token border-t px-4 py-3 text-sm">
                  <span
                    class="badge variant-soft-{serviceType.technical ? 'primary' : 'secondary'}"
                  >
                    {serviceType.technical ? 'Technical' : 'Non-Technical'}
                  </span>
                </td>
                <td
                  class="border-surface-200-700-token hidden border-t px-4 py-3 text-sm text-surface-600 dark:text-surface-400 md:table-cell"
                >
                  {#if serviceType.created_at}
                    <span title={formatDate(new Date(serviceType.created_at))}>
                      {formatDate(new Date(serviceType.created_at))}
                    </span>
                  {:else}
                    <span class="text-surface-400">—</span>
                  {/if}
                </td>
                <td
                  class="border-surface-200-700-token hidden border-t px-4 py-3 text-sm text-surface-600 dark:text-surface-400 md:table-cell"
                >
                  {#if serviceType.updated_at && serviceType.updated_at !== serviceType.created_at}
                    <span title={formatDate(new Date(serviceType.updated_at))}>
                      {formatDate(new Date(serviceType.updated_at))}
                    </span>
                  {:else}
                    <span class="text-surface-400">—</span>
                  {/if}
                </td>
                {#if showActions}
                  <td class="border-surface-200-700-token border-t px-4 py-3 text-center">
                    <div class="flex justify-center space-x-2">
                      <button
                        aria-label="View service type"
                        class="variant-ghost-primary btn btn-sm"
                        onclick={() => handleView(serviceType)}
                        title="View service type"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                      <button
                        aria-label="Edit service type"
                        class="variant-ghost-primary btn btn-sm"
                        onclick={() => handleEdit(serviceType)}
                        title="Edit service type"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        aria-label="Delete service type"
                        class="variant-ghost-error btn btn-sm"
                        onclick={() => handleDelete(serviceType)}
                        title="Delete service type"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Table Footer Info -->
      <div
        class="flex items-center justify-between px-4 text-sm text-surface-600 dark:text-surface-400"
      >
        <span>
          Showing {sortedServiceTypes.length} of {totalFilteredCount} service types
        </span>
        {#if serviceTypes.length > 0 && totalFilteredCount > 0}
          <span>
            {totalFilteredCount === serviceTypes.length
              ? 'All'
              : `${Math.round((totalFilteredCount / serviceTypes.length) * 100)}%`} results displayed
          </span>
        {/if}
      </div>
    {/if}
  </div>
{/if}
