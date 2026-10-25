<script lang="ts">
  import { safeHtml } from '$lib/utils/safe-html';
  import type { ConfirmModalMeta } from '$lib/types/ui';
  import { getModalStore } from '@skeletonlabs/skeleton';

  const modalStore = getModalStore();
  const { message, confirmLabel, cancelLabel } = $modalStore[0].meta as ConfirmModalMeta;

  function confirm() {
    $modalStore[0].response!(true);
    modalStore.close();
  }

  function cancel() {
    $modalStore[0].response!(false);
    modalStore.close();
  }
</script>

<article class="hcron-modal z-50 !bg-surface-800">
  <div class="static space-y-10">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised by safeHtml (#211) -->
    <h2 class="h3 text-center">{@html safeHtml(message)}</h2>
    <div class="flex justify-center gap-4">
      <button class="variant-filled-tertiary btn w-fit self-center" onclick={confirm}>
        {confirmLabel || 'Yes'}
      </button>
      <button type="button" class="variant-filled-error btn w-fit self-center" onclick={cancel}>
        {cancelLabel || 'No'}
      </button>
    </div>
  </div>
</article>
