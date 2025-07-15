<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { Revision } from '$lib/types/ui';
  import StatusTable from '$lib/components/shared/status/StatusTable.svelte';

  const modalStore = getModalStore();

  interface ModalMeta {
    statusHistory: Revision[];
    title: string;
  }

  const meta = $modalStore[0]?.meta as ModalMeta;
  const { statusHistory, title } = meta;
</script>

<article class="hcron-modal">
  <div class="static mb-8 space-y-10">
    <h2 class="h2 text-center">Status History</h2>

    <StatusTable {statusHistory} />
  </div>

  <button class="variant-filled-secondary btn w-fit self-center" onclick={() => modalStore.close()}>
    Close
  </button>
</article>
