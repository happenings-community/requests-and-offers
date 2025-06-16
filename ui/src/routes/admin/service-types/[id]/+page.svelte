<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import type { UIServiceType } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let serviceType: UIServiceType | null = $state(null);

  // Toast store for notifications
  const toastStore = getToastStore();

  // Derived values
  const serviceTypeId = $derived(page.params.id);

  async function handleDeleteServiceType() {
    if (!serviceType?.original_action_hash) {
      return;
    }

    if (
      !confirm('Are you sure you want to delete this service type? This action cannot be undone.')
    ) {
      return;
    }

    try {
      await runEffect(serviceTypesStore.deleteServiceType(serviceType.original_action_hash));
      toastStore.trigger({
        message: 'Service type deleted successfully',
        background: 'variant-filled-success'
      });

      // Navigate back to the service types list
      goto('/admin/service-types');
    } catch (error) {
      toastStore.trigger({
        message: `Failed to delete service type: ${error}`,
        background: 'variant-filled-error'
      });
    }
  }

  function handleEdit() {
    if (serviceType?.original_action_hash) {
      const encodedHash = encodeHashToBase64(serviceType.original_action_hash);
      goto(`/admin/service-types/${encodedHash}/edit`);
    }
  }

  // Load service type data on component mount
  $effect(() => {
    async function loadData() {
      try {
        isLoading = true;
        error = null;

        if (!serviceTypeId) {
          error = 'Invalid service type ID';
          return;
        }

        // Decode the service type hash from the URL
        const serviceTypeHash = decodeHashFromBase64(serviceTypeId);

        // Fetch the service type
        const fetchedServiceType = await runEffect(
          serviceTypesStore.getServiceType(serviceTypeHash)
        );

        if (!fetchedServiceType) {
          error = 'Service type not found';
          return;
        }

        serviceType = fetchedServiceType;
      } catch (err) {
        console.error('Failed to load service type:', err);
        error = err instanceof Error ? err.message : 'Failed to load service type';
      } finally {
        isLoading = false;
      }
    }

    loadData();
  });
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="h1">Service Type Details</h1>
    <button class="variant-soft btn" onclick={() => goto('/admin/service-types')}>
      Back to Service Types
    </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={() => goto('/admin/service-types')}>
          Back to Service Types
        </button>
      </div>
    </div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading service type...</p>
    </div>
  {:else if serviceType}
    <div class="card p-6">
      <header class="card-header flex items-start justify-between">
        <div>
          <h2 class="h2">{serviceType.name}</h2>
          <p class="mt-2 text-surface-400">{serviceType.description}</p>
        </div>

        <div class="flex gap-2">
          <button class="variant-soft-primary btn" onclick={handleEdit}> Edit </button>
          <button class="variant-soft-error btn" onclick={handleDeleteServiceType}> Delete </button>
        </div>
      </header>

      <section class="space-y-6 p-4">
        <!-- Tags -->
        {#if serviceType.tags && serviceType.tags.length > 0}
          <div>
            <h3 class="h3 mb-2">Tags</h3>
            <div class="flex flex-wrap gap-2">
              {#each serviceType.tags as tag}
                <a 
                  href={`/tags/${encodeURIComponent(tag)}`}
                  class="variant-soft-primary badge hover:variant-filled-primary cursor-pointer transition-colors"
                  title="View all content tagged with {tag}"
                >
                  {tag}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Metadata -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="card variant-soft p-4">
            <h4 class="h4 mb-2">Created</h4>
            <p class="text-sm">
              {serviceType.created_at
                ? new Date(serviceType.created_at).toLocaleDateString()
                : 'Unknown'}
            </p>
            <p class="mt-1 text-xs text-surface-500">
              by {serviceType.creator
                ? serviceType.creator.toString().slice(0, 8) + '...'
                : 'Unknown'}
            </p>
          </div>

          <div class="card variant-soft p-4">
            <h4 class="h4 mb-2">Last Updated</h4>
            <p class="text-sm">
              {serviceType.updated_at
                ? new Date(serviceType.updated_at).toLocaleDateString()
                : 'Unknown'}
            </p>
          </div>
        </div>

        <!-- Action Hashes (for debugging/admin purposes) -->
        <details class="card variant-soft p-4">
          <summary class="h4 cursor-pointer">Technical Details</summary>
          <div class="mt-4 space-y-2 text-xs">
            <div>
              <strong>Original Action Hash:</strong>
              <code class="code break-all text-xs">
                {serviceType.original_action_hash
                  ? encodeHashToBase64(serviceType.original_action_hash)
                  : 'N/A'}
              </code>
            </div>
            <div>
              <strong>Previous Action Hash:</strong>
              <code class="code break-all text-xs">
                {serviceType.previous_action_hash
                  ? encodeHashToBase64(serviceType.previous_action_hash)
                  : 'N/A'}
              </code>
            </div>
          </div>
        </details>
      </section>
    </div>
  {:else}
    <div class="text-center text-xl text-surface-500">Service type not found.</div>
  {/if}
</section>
