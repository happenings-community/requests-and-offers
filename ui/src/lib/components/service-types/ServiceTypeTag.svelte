<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { Effect as E, pipe } from 'effect';
  import type { UIServiceType } from '$lib/types/ui';

  type Props = {
    serviceTypeActionHash?: ActionHash;
    maxVisible?: number;
  };

  const { serviceTypeActionHash, maxVisible = 3 }: Props = $props();

  let serviceTypeName = $state<string | null>(null);
  let isLoadingServiceType = $state(false);
  let serviceTypeError = $state<string | null>(null);

  $effect(() => {
    if (serviceTypeActionHash) {
      isLoadingServiceType = true;
      serviceTypeError = null;

      pipe(
        serviceTypesStore.getServiceType(serviceTypeActionHash),
        E.map((result: UIServiceType | null) => result?.name || null),
        E.tap((name) => {
          serviceTypeName = name;
          isLoadingServiceType = false;
        }),
        E.catchAll((err) => {
          console.error('Error fetching service type:', err);
          serviceTypeError = 'Error loading service type.';
          serviceTypeName = null;
          isLoadingServiceType = false;
          return E.succeed(null); // Gracefully handle error, don't break the UI
        }),
        E.runPromise
      );
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
    <span class="text-surface-500 text-xs italic">No service type specified.</span>
  {:else}
    <span class="variant-soft-primary chip" title={serviceTypeName}>
      {serviceTypeName}
    </span>
  {/if}
</div>
