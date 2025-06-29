<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import type { UIServiceType } from '$lib/types/ui';
  import ServiceTypeCard from './ServiceTypeCard.svelte';
  import { encodeHashToBase64 } from '@holochain/client';
  import { goto } from '$app/navigation';

  type Props = {
    serviceTypes: UIServiceType[];
    filteredServiceTypes: UIServiceType[];
    totalFilteredCount: number;
    isLoading: boolean;
    error: string | null;
    onDeleteServiceType: (hash: ActionHash) => void;
    onRetry: () => void;
  };

  const {
    serviceTypes,
    filteredServiceTypes,
    totalFilteredCount,
    isLoading,
    error,
    onDeleteServiceType,
    onRetry
  }: Props = $props();

  function handleEdit(serviceType: UIServiceType) {
    if (serviceType.original_action_hash) {
      const encodedHash = encodeHashToBase64(serviceType.original_action_hash);
      goto(`/admin/service-types/${encodedHash}/edit`);
    }
  }

  function handleDelete(serviceType: UIServiceType) {
    if (serviceType.original_action_hash) {
      onDeleteServiceType(serviceType.original_action_hash);
    }
  }
</script>

<!-- Loading State -->
{#if isLoading}
  <div class="flex items-center justify-center space-x-2 text-center">
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
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {#each filteredServiceTypes as serviceType (serviceType.original_action_hash?.toString() || `${serviceType.name}-${serviceType.description.slice(0, 10)}`)}
          <ServiceTypeCard
            {serviceType}
            onEdit={() => handleEdit(serviceType)}
            onDelete={() => handleDelete(serviceType)}
            showActions={true}
          />
        {/each}
      </div>
    {/if}
  </div>
{/if}
