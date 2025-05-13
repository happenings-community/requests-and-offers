<script lang="ts">
  import StatusTable from '$lib/components/shared/status/StatusTable.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';

  const { allUsersStatusesHistory } = $derived(administrationStore);

  $effect(() => {
    administrationStore.getAllRevisionsForAllUsers();
  });
</script>

<section class="space-y-10">
  <h1 class="h1 text-center">Status History</h1>

  <StatusTable statusHistory={allUsersStatusesHistory} />
</section>
