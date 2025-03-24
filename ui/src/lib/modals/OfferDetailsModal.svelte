<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { UIOffer } from '@/types/ui';
  import OfferCard from '@/lib/components/OfferCard.svelte';

  const modalStore = getModalStore();

  export let meta: { offer: UIOffer };

  const { offer } = meta;
</script>

<div class="card p-4">
  <header class="flex justify-between">
    <h3 class="h3">Offer Details</h3>
    <button class="btn-icon variant-ghost" onclick={() => modalStore.close()}>✕</button>
  </header>

  <div class="mt-4">
    <OfferCard {offer} mode="expanded" showActions={true} />
  </div>

  <footer class="mt-4 flex justify-end">
    <button class="btn variant-ghost" onclick={() => modalStore.close()}>Close</button>
  </footer>
</div>
