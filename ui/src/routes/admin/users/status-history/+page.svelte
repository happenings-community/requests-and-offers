<script lang="ts">
  import StatusTable from '$lib/components/shared/status/StatusTable.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { storeEventBus } from '$lib/stores/storeEvents';
  import { Effect as E } from 'effect';
  import { onMount, onDestroy } from 'svelte';

  const { allUsersStatusesHistory } = $derived(administrationStore);

  let unsubscribeUserStatus: (() => void) | null = null;
  let unsubscribeOrgStatus: (() => void) | null = null;

  // Subscribe to status update events for reactive updates
  onMount(() => {
    console.log('🔄 TDD: Setting up status update event listeners');

    // Listen for user status updates
    unsubscribeUserStatus = storeEventBus.on('user:status:updated', () => {
      console.log('🔄 TDD: User status updated - refreshing status history');
      E.runFork(administrationStore.fetchAllUsersStatusHistory());
    });

    // Listen for organization status updates
    unsubscribeOrgStatus = storeEventBus.on('organization:status:updated', () => {
      console.log('🔄 TDD: Organization status updated - refreshing status history');
      E.runFork(administrationStore.fetchAllOrganizationsStatusHistory());
    });

    E.runFork(administrationStore.fetchAllUsersStatusHistory());
  });

  // Cleanup subscriptions
  onDestroy(() => {
    console.log('🔄 TDD: Cleaning up status update event listeners');
    if (unsubscribeUserStatus) unsubscribeUserStatus();
    if (unsubscribeOrgStatus) unsubscribeOrgStatus();
  });

  // Reactive effect to log changes in status history array
  $effect(() => {
    console.log('🔄 TDD: Status history array changed');
    console.log('🔄 TDD: Current allUsersStatusesHistory.length:', allUsersStatusesHistory.length);
    console.log('🔄 TDD: Users status history array detailed:', allUsersStatusesHistory);

    if (allUsersStatusesHistory.length > 0) {
      console.log('🔄 TDD: First status history item:', allUsersStatusesHistory[0]);
      console.log(
        '🔄 TDD: All status history items breakdown:',
        allUsersStatusesHistory.map((item, index) => ({
          index: index + 1,
          user: item.entity?.name,
          status: item.status?.status_type,
          timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : 'No timestamp',
          reason: item.status?.reason || 'No reason'
        }))
      );
    }
  });
</script>

<section class="space-y-10">
  <h1 class="h1 text-center">Status History</h1>

  <StatusTable statusHistory={allUsersStatusesHistory} />
</section>
