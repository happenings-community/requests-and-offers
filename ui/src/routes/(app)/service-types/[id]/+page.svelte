<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { UIServiceType } from '$lib/types/ui';

  // Local state
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let serviceType: UIServiceType | null = $state(null);

  const serviceTypeId = $derived(page.params.id);

  $effect(() => {
    async function load() {
      try {
        isLoading = true;
        if (!serviceTypeId) {
          error = 'Invalid service type id';
          return;
        }
        const hash = decodeHashFromBase64(serviceTypeId);
        const result = await runEffect(serviceTypesStore.getServiceType(hash));
        if (!result) {
          error = 'Service type not found';
          return;
        }
        serviceType = result;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      } finally {
        isLoading = false;
      }
    }
    load();
  });
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="h1">Service Type Details</h1>
    <button class="btn variant-soft" onclick={() => goto('/service-types')}>Back to Service Types</button>
  </div>

  {#if error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
    </div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading service type...</p>
    </div>
  {:else if serviceType}
    <div class="card p-6">
      <header class="card-header">
        <h2 class="h2">{serviceType.name}</h2>
        <p class="text-surface-600 mt-2">{serviceType.description}</p>
      </header>

      <section class="p-4 space-y-6">
        {#if serviceType.tags && serviceType.tags.length > 0}
          <div>
            <h3 class="h3 mb-2">Tags</h3>
            <div class="flex flex-wrap gap-2">
              {#each serviceType.tags as tag}
                <span class="badge variant-soft-primary">{tag}</span>
              {/each}
            </div>
          </div>
        {/if}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="card variant-soft p-4">
            <h4 class="h4 mb-2">Created</h4>
            <p class="text-sm">{serviceType.created_at ? new Date(serviceType.created_at).toLocaleDateString() : 'Unknown'}</p>
          </div>
          <div class="card variant-soft p-4">
            <h4 class="h4 mb-2">Last Updated</h4>
            <p class="text-sm">{serviceType.updated_at ? new Date(serviceType.updated_at).toLocaleDateString() : 'Unknown'}</p>
          </div>
        </div>

        <details class="card variant-soft p-4">
          <summary class="h4 cursor-pointer">Technical Details</summary>
          <div class="mt-4 space-y-2 text-xs">
            <div>
              <strong>Original Action Hash:</strong>
              <code class="code text-xs break-all">{serviceType.original_action_hash ? encodeHashToBase64(serviceType.original_action_hash) : 'N/A'}</code>
            </div>
            {#if serviceType.previous_action_hash}
              <div>
                <strong>Previous Action Hash:</strong>
                <code class="code text-xs break-all">{serviceType.previous_action_hash ? encodeHashToBase64(serviceType.previous_action_hash) : 'N/A'}</code>
              </div>
            {/if}
          </div>
        </details>
      </section>
    </div>
  {/if}
</section> 