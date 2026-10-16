<script lang="ts">
  import { onMount } from 'svelte';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import ApprovalModal from '$lib/components/users/ApprovalModal.svelte';
  import { useApprovalWatch } from '$lib/composables/domain/users/useApprovalWatch.svelte';

  const modalStore = getModalStore();

  // Any way the modal closes reloads the app, so every store starts from the
  // accepted status rather than the cached pending one.
  const watch = useApprovalWatch({
    onAccepted: () =>
      modalStore.trigger({
        type: 'component',
        component: { ref: ApprovalModal },
        response: () => window.location.reload()
      })
  });

  onMount(() => watch.start());
</script>
