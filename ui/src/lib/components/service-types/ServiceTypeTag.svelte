<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { Effect as E } from 'effect';
  import type { ServiceTypesStore } from '$lib/stores/serviceTypes.store.svelte';

  type Props = {
    serviceTypeActionHash?: ActionHash;
    maxVisible?: number;
  };

  const { serviceTypeActionHash, maxVisible = 3 }: Props = $props();

  let serviceTypeName = $state<string | null>(null);
  let isLoadingServiceType = $state(false);
  let serviceTypeError = $state<string | null>(null);

  // Cast the store to the correct type
  const typedStore = serviceTypesStore as ServiceTypesStore;

  $effect(() => {
    if (serviceTypeActionHash) {
      isLoadingServiceType = true;
      serviceTypeError = null;

      // Safely load the service type with proper error handling
      const loadServiceType = async () => {
        try {
          // First just try to get the service type directly
          const result = await E.runPromise(typedStore.getServiceType(serviceTypeActionHash));
          if (result) {
            serviceTypeName = result.name;
          } else {
            // If not found, don't try to initialize here - that should be done by the selector
            // Just set a generic name as fallback
            serviceTypeName = 'Service';
            console.warn('Service type not found, using generic name');
          }
        } catch (error) {
          // Check if it's a connection error
          const errorMessage = String(error);
          if (errorMessage.includes('Client not connected')) {
            console.warn('Holochain client not connected yet, will retry when connected');
            serviceTypeError = 'Connecting...';
            // We'll retry when the client connects via the layout component
          } else {
            console.error('Error fetching service type:', error);
            serviceTypeError = 'Service type unavailable';
            serviceTypeName = null;
          }
        } finally {
          isLoadingServiceType = false;
        }
      };

      loadServiceType();
    } else {
      serviceTypeName = null;
      isLoadingServiceType = false;
      serviceTypeError = null;
    }
  });
</script>

<div class="flex flex-wrap items-center gap-2">
  {#if isLoadingServiceType}
    <span class="text-surface-500 text-xs italic">Loading service type...</span>
  {:else if serviceTypeError}
    <span class="text-error-500 text-xs italic">{serviceTypeError}</span>
  {:else if !serviceTypeName}
    <span class="text-surface-500 text-xs italic">
      {#await E.runPromise(typedStore.hasServiceTypes()) then hasTypes}
        {#if hasTypes}
          No service type specified.
        {:else}
          No service types available. <a href="/admin/service-types" class="underline hover:text-primary-500">Create service types</a>
        {/if}
      {/await}
    </span>
  {:else}
    <span class="variant-soft-primary chip" title={serviceTypeName}>
      {serviceTypeName}
    </span>
  {/if}
</div>
