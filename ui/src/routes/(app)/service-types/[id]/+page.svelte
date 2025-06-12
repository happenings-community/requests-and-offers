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
    <button class="variant-soft btn" onclick={() => goto('/service-types')}>
      Back to Service Types
    </button>
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
        <p class="mt-2 text-surface-600">{serviceType.description}</p>
      </header>

      <section class="space-y-6 p-4">
        {#if serviceType.tags && serviceType.tags.length > 0}
          <div>
            <h3 class="h3 mb-2">Tags</h3>
            <div class="flex flex-wrap gap-2">
              {#each serviceType.tags as tag}
                <span class="variant-soft-primary badge">{tag}</span>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    </div>
  {/if}
</section>
