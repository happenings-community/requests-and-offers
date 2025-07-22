<script lang="ts">
  import StatusTable from '$lib/components/shared/status/StatusTable.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { Effect as E } from 'effect';

  const { allUsersStatusesHistory } = $derived(administrationStore);

  // Fetch status history for all users when the page loads
  $effect(() => {
    // If status history is empty, trigger a fetch
    if (allUsersStatusesHistory.length === 0) {
      console.log('Fetching users status history...');
      E.runFork(administrationStore.fetchAllUsersStatusHistory());
    }
    console.log('Users status history array:', allUsersStatusesHistory);
    console.log('Users status history length:', allUsersStatusesHistory.length);
    if (allUsersStatusesHistory.length > 0) {
      console.log('First status history item:', allUsersStatusesHistory[0]);
      console.log('All status history items:', allUsersStatusesHistory);
    }
  });
</script>

<section class="space-y-10">
  <h1 class="h1 text-center">Status History</h1>

  <StatusTable statusHistory={allUsersStatusesHistory} />
</section>
