<script lang="ts">
  import StatusTable from '$lib/components/shared/status/StatusTable.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { storeEventBus } from '$lib/stores/storeEvents';
  import { ConicGradient, type ConicStop } from '@skeletonlabs/skeleton';
  import { Effect as E } from 'effect';
  import { onMount, onDestroy } from 'svelte';

  const { allOrganizationsStatusesHistory } = $derived(administrationStore);
  let isLoading = $state(true);

  let unsubscribeOrgStatus: (() => void) | null = null;

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-secondary-500))', start: 75, end: 50 }
  ];

  function loadStatusHistory() {
    E.runFork(administrationStore.fetchAllOrganizationsStatusHistory());
  }

  onMount(() => {
    // Refetch whenever an organisation status changes, so the table does not
    // need a page refresh to show a new revision.
    unsubscribeOrgStatus = storeEventBus.on('organization:status:updated', () => {
      loadStatusHistory();
    });

    loadStatusHistory();
    isLoading = false;
  });

  onDestroy(() => {
    if (unsubscribeOrgStatus) unsubscribeOrgStatus();
  });
</script>

<section class="space-y-10">
  <h1 class="h1 text-center">Organizations Status History</h1>

  <div class="flex justify-center gap-4">
    <a href="/admin/organizations" class="variant-ghost-secondary btn w-fit">
      Back to Organizations
    </a>
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center gap-2">
      <ConicGradient stops={conicStops} spin />
      <p>Loading status history...</p>
    </div>
  {:else}
    <StatusTable statusHistory={allOrganizationsStatusesHistory} />
  {/if}
</section>
