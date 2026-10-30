<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';

  const modalStore = getModalStore();

  function continueToApp() {
    $modalStore[0]?.response?.(true);
    modalStore.close();
  }
</script>

<article class="hcron-modal z-50 !bg-surface-800">
  <div class="flex flex-col items-center gap-6 text-center">
    <h2 class="h3">Your membership has been approved</h2>
    <p>
      You can now register interest in listings and make proposals. The app will reload to bring
      everything up to date.
    </p>
    <button class="variant-filled-primary btn" onclick={continueToApp}>Continue</button>
  </div>
</article>
