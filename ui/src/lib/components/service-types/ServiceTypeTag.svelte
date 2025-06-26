<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import { encodeHashToBase64 } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { Effect as E } from 'effect';

  type Props = {
    serviceTypeActionHash?: ActionHash;
  };

  const { serviceTypeActionHash }: Props = $props();

  let serviceTypeName = $state<string | null>(null);
  let isLoadingServiceType = $state(false);
  let serviceTypeError = $state<string | null>(null);
  let retryAttempts = $state(0);
  const MAX_RETRY_ATTEMPTS = 2;

  // Load service type when hash changes
  $effect(() => {
    if (serviceTypeActionHash && serviceTypesStore) {
      loadServiceType();
    } else {
      resetState();
    }
  });

  function resetState() {
    serviceTypeName = null;
    isLoadingServiceType = false;
    serviceTypeError = null;
    retryAttempts = 0;
  }

  async function loadServiceType() {
    if (!serviceTypesStore || !serviceTypeActionHash) return;

    isLoadingServiceType = true;
    serviceTypeError = null;

    try {
      const result = await E.runPromise(serviceTypesStore.getServiceType(serviceTypeActionHash));
      if (result) {
        serviceTypeName = result.name;
        retryAttempts = 0; // Reset retry counter on success
      } else {
        // Service type not found - this could be a newly created service type
        // that hasn't been approved yet or a cache miss
        await handleServiceTypeNotFound();
      }
    } catch (error) {
      await handleServiceTypeError(error);
    } finally {
      isLoadingServiceType = false;
    }
  }

  async function handleServiceTypeNotFound() {
    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
      // Try to invalidate cache and retry
      serviceTypesStore.invalidateCache();
      retryAttempts++;
      
      setTimeout(() => {
        if (serviceTypeActionHash) {
          loadServiceType();
        }
      }, 1000 * retryAttempts); // Exponential backoff
      
      serviceTypeError = `Loading service type... (attempt ${retryAttempts}/${MAX_RETRY_ATTEMPTS})`;
    } else {
      // After max retries, show a more user-friendly message
      serviceTypeName = 'Service Type';
      serviceTypeError = null;
      console.warn('Service type not found after retries, using generic name:', serviceTypeActionHash ? encodeHashToBase64(serviceTypeActionHash) : 'unknown');
    }
  }

  async function handleServiceTypeError(error: unknown) {
    const errorMessage = String(error);
    
    if (errorMessage.includes('Client not connected')) {
      serviceTypeError = 'Connecting...';
      // Retry after a delay when client connects
      setTimeout(() => {
        if (serviceTypeActionHash) {
          loadServiceType();
        }
      }, 3000);
    } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('UserProfileRequired')) {
      // This service type might be pending approval - show a user-friendly message
      serviceTypeName = 'Service Type';
      serviceTypeError = null;
      console.info('Service type access restricted (may be pending approval):', serviceTypeActionHash ? encodeHashToBase64(serviceTypeActionHash) : 'unknown');
    } else {
      // For other errors, try retry logic
      if (retryAttempts < MAX_RETRY_ATTEMPTS) {
        retryAttempts++;
        setTimeout(() => {
          if (serviceTypeActionHash) {
            loadServiceType();
          }
        }, 1000 * retryAttempts);
        serviceTypeError = `Retrying... (${retryAttempts}/${MAX_RETRY_ATTEMPTS})`;
      } else {
        // After max retries, use fallback
        serviceTypeName = 'Service Type';
        serviceTypeError = null;
        console.error('Failed to load service type after retries:', error);
      }
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

  // Manual retry function for user-triggered retries
  function retryLoad() {
    retryAttempts = 0;
    loadServiceType();
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  {#if isLoadingServiceType}
    <span class="text-surface-500 text-xs italic flex items-center gap-1">
      <span class="loading loading-spinner loading-xs"></span>
      {serviceTypeError || 'Loading service type...'}
    </span>
  {:else if serviceTypeError && !serviceTypeName}
    <span class="text-warning-500 text-xs italic flex items-center gap-1">
      {serviceTypeError}
      {#if retryAttempts < MAX_RETRY_ATTEMPTS}
        <button 
          class="btn btn-xs variant-ghost-warning" 
          onclick={retryLoad}
          title="Retry loading service type"
        >
          ↻
        </button>
      {/if}
    </span>
  {:else if !serviceTypeName}
    <span class="text-error-500 text-xs italic">
      {#await checkHasServiceTypes() then hasTypes}
        {#if !hasTypes}
          No service types available
        {:else}
          Service type unavailable
        {/if}
      {/await}
    </span>
  {:else}
    <a 
      href={`/service-types/${serviceTypeActionHash ? encodeHashToBase64(serviceTypeActionHash) : '#'}`}
      class="variant-filled-tertiary chip hover:variant-filled-secondary cursor-pointer transition-colors"
      title={`View ${serviceTypeName} details`}
    >
      {serviceTypeName}
    </a>
  {/if}
</div>
