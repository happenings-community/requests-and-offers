<script lang="ts">
  import StatusTable from '$lib/components/shared/status/StatusTable.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { ConicGradient, type ConicStop } from '@skeletonlabs/skeleton';

  const { allOrganizationsStatusesHistory } = $derived(administrationStore);
  let isLoading = $state(true);

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-secondary-500))', start: 75, end: 50 }
  ];

  async function loadStatusHistory() {
    // This would require implementing a method to get status history for all organizations
    // For now, use the existing allOrganizationsStatusesHistory from the store
    console.log('Organizations status history:', allOrganizationsStatusesHistory);
    isLoading = false;
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
