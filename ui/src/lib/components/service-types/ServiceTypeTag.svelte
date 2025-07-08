<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import { encodeHashToBase64, decodeHashFromBase64 } from '@holochain/client';
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

  // Helper function to normalize ActionHash format
  function normalizeActionHash(hash: any): ActionHash | null {
    if (!hash) return null;

    // If it's already a Uint8Array, return it
    if (hash instanceof Uint8Array) {
      return hash as ActionHash;
    }

    // If it's a string, try to decode it from base64
    if (typeof hash === 'string') {
      try {
        // First check if it's a valid base64 string
        if (/^[A-Za-z0-9+/]*={0,2}$/.test(hash)) {
          return decodeHashFromBase64(hash);
        } else {
          console.warn('Invalid base64 string format for ActionHash:', hash);
          return null;
        }
      } catch (error) {
        console.warn('Failed to decode ActionHash from base64:', hash, error);
        return null;
      }
    }

    console.warn('Unknown ActionHash format:', typeof hash, hash);
    return null;
  }

  // Load service type when hash changes
  $effect(() => {
    const normalizedHash = normalizeActionHash(serviceTypeActionHash);
    if (normalizedHash && serviceTypesStore) {
      loadServiceType(normalizedHash);
    } else {
      resetState();
      if (serviceTypeActionHash && !normalizedHash) {
        console.warn('Could not normalize ActionHash:', serviceTypeActionHash);
        serviceTypeError = 'Invalid service type reference';
      }
    }
  });

  function resetState() {
    serviceTypeName = null;
    isLoadingServiceType = false;
    serviceTypeError = null;
    retryAttempts = 0;
  }

  async function loadServiceType(hash: ActionHash) {
    if (!serviceTypesStore) return;

    isLoadingServiceType = true;
    serviceTypeError = null;

    try {
      const result = await E.runPromise(serviceTypesStore.getServiceType(hash));
      if (result) {
        serviceTypeName = result.name;
        retryAttempts = 0; // Reset retry counter on success
      } else {
        // Service type not found - this could be a newly created service type
        // that hasn't been approved yet or a cache miss
        await handleServiceTypeNotFound(hash);
      }
    } catch (error) {
      await handleServiceTypeError(error, hash);
    } finally {
      isLoadingServiceType = false;
    }
  }

  async function handleServiceTypeNotFound(hash: ActionHash) {
    if (retryAttempts < MAX_RETRY_ATTEMPTS) {
      // Try to invalidate cache and retry
      serviceTypesStore.invalidateCache();
      retryAttempts++;

      setTimeout(() => {
        loadServiceType(hash);
      }, 1000 * retryAttempts); // Exponential backoff

      serviceTypeError = `Loading service type... (attempt ${retryAttempts}/${MAX_RETRY_ATTEMPTS})`;
    } else {
      // After max retries, show a more user-friendly message
      serviceTypeName = 'Service Type';
      serviceTypeError = null;
      console.warn(
        'Service type not found after retries, using generic name:',
        encodeHashToBase64(hash)
      );
    }
  }

  async function handleServiceTypeError(error: unknown, hash: ActionHash) {
    const errorMessage = String(error);

    if (errorMessage.includes('Client not connected')) {
      serviceTypeError = 'Connecting...';
      // Retry after a delay when client connects
      setTimeout(() => {
        loadServiceType(hash);
      }, 3000);
    } else if (
      errorMessage.includes('Unauthorized') ||
      errorMessage.includes('UserProfileRequired')
    ) {
      // This service type might be pending approval - show a user-friendly message
      serviceTypeName = 'Service Type';
      serviceTypeError = null;
      console.info(
        'Service type access restricted (may be pending approval):',
        encodeHashToBase64(hash)
      );
    } else {
      // For other errors, try retry logic
      if (retryAttempts < MAX_RETRY_ATTEMPTS) {
        retryAttempts++;
        setTimeout(() => {
          loadServiceType(hash);
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
    const normalizedHash = normalizeActionHash(serviceTypeActionHash);
    if (normalizedHash) {
      retryAttempts = 0;
      loadServiceType(normalizedHash);
    }
  }

  // Helper function for safe hash encoding in the template
  function safeEncodeHash(hash: any): string {
    const normalizedHash = normalizeActionHash(hash);
    return normalizedHash ? encodeHashToBase64(normalizedHash) : '#';
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  {#if isLoadingServiceType}
    <span class="text-surface-500 flex items-center gap-1 text-xs italic">
      <span class="loading loading-spinner loading-xs"></span>
      {serviceTypeError || 'Loading service type...'}
    </span>
  {:else if serviceTypeError && !serviceTypeName}
    <span class="text-warning-500 flex items-center gap-1 text-xs italic">
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
      href={`/service-types/${safeEncodeHash(serviceTypeActionHash)}`}
      class="variant-filled-tertiary chip hover:variant-filled-secondary cursor-pointer transition-colors"
      title={`View ${serviceTypeName} details`}
    >
      {serviceTypeName}
    </a>
  {/if}
</div>
