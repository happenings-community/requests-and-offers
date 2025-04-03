<script lang="ts">
  import StatusTable from '@lib/tables/StatusTable.svelte';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { Revision } from '@types/ui';

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

  <button class="btn variant-filled-secondary w-fit self-center" onclick={() => modalStore.close()}>
    Close
  </button>
</article>
