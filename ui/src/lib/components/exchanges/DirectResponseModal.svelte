<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIRequest, UIOffer } from '$lib/types/ui';
  import DirectResponseInterface from './DirectResponseInterface.svelte';

  // Modal store
  const modalStore = getModalStore();

  // Props from modal meta
  type DirectResponseModalMeta = {
    entity: UIRequest | UIOffer;
    entityType: 'request' | 'offer';
    entityHash: ActionHash;
  };

  const meta = $derived.by(() => {
    return $modalStore[0]?.meta as DirectResponseModalMeta;
  });

  // Extract props
  const entity = $derived(meta?.entity);
  const entityType = $derived(meta?.entityType);
  const entityHash = $derived(meta?.entityHash);

  function handleClose() {
    modalStore.close();
  }
</script>

{#if entity && entityType && entityHash}
  <div class="card w-modal-wide max-w-[90vw] max-h-[90vh] overflow-y-auto">
    <!-- Modal Header -->
    <header class="card-header flex items-center justify-between">
      <h2 class="h3 font-semibold">
        Respond to {entityType === 'request' ? 'Request' : 'Offer'}
      </h2>
      <button 
        class="btn-icon variant-ghost-surface"
        onclick={handleClose}
        aria-label="Close modal"
      >
        <span class="material-symbols-outlined">close</span>
      </button>
    </header>

    <!-- Modal Body -->
    <section class="p-6">
      <!-- Entity Preview -->
      <div class="card variant-soft-surface p-4 mb-6">
        <h3 class="h4 font-semibold mb-2">{entity.title}</h3>
        <p class="text-surface-600 dark:text-surface-400 text-sm line-clamp-3">
          {entity.description}
        </p>
      </div>

      <!-- Direct Response Interface -->
      <DirectResponseInterface 
        {entity}
        {entityType}
        {entityHash}
      />
    </section>
  </div>
{/if}