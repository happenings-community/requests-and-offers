<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { Effect as E, Option as O, Data, pipe } from 'effect';

  // Define a custom error type for service type loading
  class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{
    message: string;
    cause?: unknown;
  }> {}

  type Props = {
    serviceTypeActionHash?: ActionHash;
  };

  const { serviceTypeActionHash }: Props = $props();

  let serviceTypeName = $state<O.Option<string>>(O.none());
  let isLoadingServiceType = $state(false);
  let serviceTypeError = $state<O.Option<ServiceTypeError>>(O.none());

  // Load service type when hash changes
  $effect(() => {
    if (serviceTypeActionHash && serviceTypesStore) {
      loadServiceType();
    } else {
      serviceTypeName = O.none();
      isLoadingServiceType = false;
      serviceTypeError = O.none();
    }
  });

  // Effect to load service type data
  const loadServiceTypeEffect = (actionHash: ActionHash) =>
    E.gen(function* ($) {
      // Try to get the service type
      const resultEffect = serviceTypesStore.getServiceType(actionHash);
      const result = yield* $(resultEffect);

      // Get the name or use a default
      const name = result ? result.name : 'Service';

      // Update state
      yield* $(
        E.sync(() => {
          serviceTypeName = O.some(name);
          serviceTypeError = O.none();
          if (!result) {
            console.warn('Service type not found, using generic name');
          }
        })
      );

      return name;
    }).pipe(
      // Error handling
      E.catchAll((error) =>
        E.sync(() => {
          const errorMessage = String(error);
          const serviceError = new ServiceTypeError({
            message: errorMessage.includes('Client not connected')
              ? 'Connecting...'
              : 'Service type unavailable',
            cause: error
          });

          if (serviceError.message === 'Connecting...') {
            console.warn('Holochain client not connected yet');
          } else {
            console.error('Error fetching service type:', error);
          }

          serviceTypeError = O.some(serviceError);
          serviceTypeName = O.none();
          return null;
        })
      )
    );

  function loadServiceType() {
    if (!serviceTypesStore || !serviceTypeActionHash) return;

    isLoadingServiceType = true;
    serviceTypeError = O.none();

    pipe(loadServiceTypeEffect(serviceTypeActionHash), E.runPromise)
      .then(() => {
        isLoadingServiceType = false;
      })
      .catch((err) => {
        console.error('Unhandled error in loadServiceType:', err);
        isLoadingServiceType = false;
      });
  }

  // Effect to check if service types exist
  const hasServiceTypesEffect = E.gen(function* ($) {
    if (!serviceTypesStore) return false;
    try {
      return yield* $(serviceTypesStore.hasServiceTypes());
    } catch {
      return false;
    }
  });

  // Function to check if service types exist
  function checkHasServiceTypes(): Promise<boolean> {
    return E.runPromise(hasServiceTypesEffect);
  }

  // Function to retry loading service type
  function retryLoadServiceType() {
    if (serviceTypeActionHash) {
      isLoadingServiceType = true;
      serviceTypeError = O.none();

      pipe(loadServiceTypeEffect(serviceTypeActionHash), E.runPromise)
        .then(() => {
          isLoadingServiceType = false;
        })
        .catch((err) => {
          console.error('Unhandled error in retry:', err);
          isLoadingServiceType = false;
        });
    }
  }
</script>

<div class="flex flex-wrap items-center gap-2">
  {#if isLoadingServiceType}
    <span class="flex items-center gap-1 text-xs italic text-surface-500">
      <span class="spinner-border-sm border-secondary-500"></span>
      Loading service type...
    </span>
  {:else if O.isSome(serviceTypeError)}
    <span class="flex items-center gap-1 text-xs italic text-error-500">
      {O.getOrNull(serviceTypeError)?.message}
      <button
        class="btn-xs variant-soft-secondary btn-icon"
        onclick={retryLoadServiceType}
        title="Retry loading service type"
      >
        ↻
      </button>
    </span>
  {:else if O.isNone(serviceTypeName)}
    <span class="text-xs italic text-error-500">
      {#await checkHasServiceTypes() then hasTypes}
        {#if !hasTypes}
          No service types found.
        {/if}
      {/await}
    </span>
  {:else}
    <span class="variant-filled-tertiary chip" title={O.getOrNull(serviceTypeName)}>
      {O.getOrNull(serviceTypeName)}
    </span>
  {/if}
</div>
