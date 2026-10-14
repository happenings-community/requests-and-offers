<script lang="ts">
  import type { AlertModalMeta } from '$lib/types/ui';
  import { getModalStore } from '@skeletonlabs/skeleton';

  const modalStore = getModalStore();
  const { message, confirmLabel } = $modalStore[0].meta as AlertModalMeta;
</script>

<article class="hcron-modal z-50 !bg-surface-800">
  <div class="flex flex-col items-center gap-8">
    {@html message}
    <button class="variant-filled-secondary btn" onclick={modalStore.close}>
      {confirmLabel || 'Ok'}
    </button>
  </div>
</article>
