<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { Effect as E } from 'effect';

  type Props = {
    serviceTypeActionHash?: ActionHash;
  };

  const { serviceTypeActionHash }: Props = $props();

  let serviceTypeName = $state<string | null>(null);
  let isLoadingServiceType = $state(false);
  let serviceTypeError = $state<string | null>(null);

  // Load service type when hash changes
  $effect(() => {
    if (serviceTypeActionHash && serviceTypesStore) {
      loadServiceType();
    } else {
      serviceTypeName = null;
      isLoadingServiceType = false;
      serviceTypeError = null;
    }
  });

  async function loadServiceType() {
    if (!serviceTypesStore || !serviceTypeActionHash) return;

    isLoadingServiceType = true;
    serviceTypeError = null;

    try {
      const result = await E.runPromise(serviceTypesStore.getServiceType(serviceTypeActionHash));
      if (result) {
        serviceTypeName = result.name;
      } else {
        serviceTypeName = 'Service';
        console.warn('Service type not found, using generic name');
      }
    } catch (error) {
      const errorMessage = String(error);
      if (errorMessage.includes('Client not connected')) {
        console.warn('Holochain client not connected yet');
        serviceTypeError = 'Connecting...';
      } else {
        console.error('Error fetching service type:', error);
        serviceTypeError = 'Service type unavailable';
        serviceTypeName = null;
      }
    } finally {
      isLoadingServiceType = false;
    }
  }

  async function checkHasServiceTypes(): Promise<boolean> {
    if (!serviceTypesStore) return false;
    try {
      return await E.runPromise(serviceTypesStore.hasServiceTypes());
    } catch {
      return false;
    }
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  {#if isLoadingServiceType}
    <span class="text-surface-500 text-xs italic">Loading service type...</span>
  {:else if serviceTypeError}
    <span class="text-error-500 text-xs italic">{serviceTypeError}</span>
  {:else if !serviceTypeName}
    <span class="text-surface-500 text-xs italic">
      {#await checkHasServiceTypes() then hasTypes}
        {#if hasTypes}
          No service type specified.
        {:else}
          No service types available.
        {/if}
      {/await}
    </span>
  {:else}
    <span class="variant-soft-primary chip" title={serviceTypeName}>
      {serviceTypeName}
    </span>
  {/if}
</div>
