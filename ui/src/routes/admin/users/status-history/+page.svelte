<script lang="ts">
  import StatusTable from '$lib/components/shared/status/StatusTable.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';

  const { allUsersStatusesHistory } = $derived(administrationStore);

  // Fetch status history for all users when the page loads
  $effect(() => {
    // This would require implementing a method to get status history for all users
    // For now, use the existing allUsersStatusesHistory from the store
    console.log('Users status history:', allUsersStatusesHistory);
  });
</script>

<section class="space-y-10">
  <h1 class="h1 text-center">Status History</h1>

  <StatusTable statusHistory={allUsersStatusesHistory} />
</section>
