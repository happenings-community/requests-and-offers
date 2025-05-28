<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { Effect as E, pipe } from 'effect';
  import type { UIServiceType } from '$lib/types/ui';

  type Props = {
    requirements?: string[];
    capabilities?: string[]; // For backward compatibility with offers
    serviceTypeActionHash?: ActionHash;
    maxVisible?: number;
  };

  const { requirements, capabilities, serviceTypeActionHash, maxVisible = 3 }: Props = $props();

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

  const currentDisplayItems = $derived(() => {
    if (serviceTypeName) {
      return [serviceTypeName];
    }
    // Check requirements first, then capabilities for backward compatibility
    return requirements || capabilities || [];
  });

  // Determine if we need to show "more" indicator
  const visibleItems = $derived(currentDisplayItems().slice(0, maxVisible));
  const hiddenItemsCount = $derived(Math.max(0, currentDisplayItems().length - maxVisible));

  // Toggle to show all items
  let showAllItems = $state(false);

  function toggleItemsDisplay() {
    showAllItems = !showAllItems;
  }

  // Compute final items to display
  const displayItems = $derived(showAllItems ? currentDisplayItems() : visibleItems);
</script>

<div class="flex flex-wrap items-center gap-2">
  {#if isLoadingServiceType}
    <span class="text-xs italic text-surface-500">Loading service type...</span>
  {:else if serviceTypeError}
    <span class="text-xs italic text-error-500">{serviceTypeError}</span>
  {:else if displayItems.length === 0 && (!requirements || requirements.length === 0)}
    <span class="text-xs italic text-surface-500">No service type specified.</span>
  {:else}
    {#each displayItems as item}
      <span class="variant-soft-primary chip" title={item}>
        {item}
      </span>
    {/each}

    {#if hiddenItemsCount > 0 && !showAllItems}
      <button class="variant-soft-secondary chip" onclick={toggleItemsDisplay}>
        +{hiddenItemsCount} more
      </button>
    {/if}

    {#if showAllItems && hiddenItemsCount > 0}
      <button class="variant-soft-secondary chip" onclick={toggleItemsDisplay}>
        Show less
      </button>
    {/if}
  {/if}
</div>
