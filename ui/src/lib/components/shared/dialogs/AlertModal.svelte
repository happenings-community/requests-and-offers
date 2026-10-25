<script lang="ts">
  import type { AlertModalMeta } from '$lib/types/ui';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';

  const modalStore = getModalStore();
  const { message, confirmLabel, confirmHref } = $modalStore[0].meta as AlertModalMeta;

  function confirm() {
    modalStore.close();
    if (confirmHref) goto(confirmHref);
  }
</script>

<article class="hcron-modal z-50 !bg-surface-800">
  <div class="flex flex-col items-center gap-8">
    {@html message}
    <button class="variant-filled-secondary btn" onclick={confirm}>
      {confirmLabel || 'Ok'}
    </button>
  </div>
</article>
