<script lang="ts">
  import StatusTable from '$lib/components/shared/status/StatusTable.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { ConicGradient, type ConicStop } from '@skeletonlabs/skeleton';
  import { Effect as E } from 'effect';

  const { allOrganizationsStatusesHistory } = $derived(administrationStore);
  let isLoading = $state(true);

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-secondary-500))', start: 75, end: 50 }
  ];

  async function loadStatusHistory() {
    try {
      // If status history is empty, trigger a fetch
      if (allOrganizationsStatusesHistory.length === 0) {
        E.runFork(administrationStore.fetchAllOrganizationsStatusHistory());
      }
      console.log('Organizations status history:', allOrganizationsStatusesHistory);
    } catch (error) {
      console.error('Failed to load organizations status history:', error);
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    loadStatusHistory();
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
