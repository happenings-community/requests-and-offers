<script lang="ts">
  import { safeHtml } from '$lib/utils/safe-html';
  import type { AlertModalMeta } from '$lib/types/ui';
  import { getModalStore } from '@skeletonlabs/skeleton';

  const modalStore = getModalStore();
  const { message, confirmLabel } = $modalStore[0].meta as AlertModalMeta;
</script>

<article class="hcron-modal z-50 !bg-surface-800">
  <div class="flex flex-col items-center gap-8">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitised by safeHtml (#211) -->
    {@html safeHtml(message)}
    <button class="variant-filled-secondary btn" onclick={modalStore.close}>
      {confirmLabel || 'Ok'}
    </button>
  </div>
</article>
