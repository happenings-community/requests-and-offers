<script lang="ts">
  import { goto } from '$app/navigation';
  import { getModalStore } from '@skeletonlabs/skeleton';

  // Shown to a pending member when an administrator asks for more information
  // (#331). Plain text: the request is the administrator's own words.
  const modalStore = getModalStore();
  const request = String($modalStore[0]?.meta?.request ?? '');

  function editProfile() {
    modalStore.close();
    goto('/user/edit');
  }
</script>

<article class="hcron-modal z-50 !bg-surface-800">
  <div class="flex flex-col items-center gap-6 text-center">
    <h2 class="h3">An administrator has asked for more information</h2>
    <p class="whitespace-pre-line">{request}</p>
    <p class="text-sm">Answer by editing your profile.</p>
    <div class="flex flex-wrap justify-center gap-4">
      <button class="variant-filled-primary btn" onclick={editProfile}>Edit your profile</button>
      <button class="variant-filled-surface btn" onclick={() => modalStore.close()}>Later</button>
    </div>
  </div>
</article>
