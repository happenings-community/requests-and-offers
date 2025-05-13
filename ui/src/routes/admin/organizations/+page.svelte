<script lang="ts">
  import { ConicGradient, type ConicStop, getToastStore } from '@skeletonlabs/skeleton';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import OrganizationsTable from '$lib/components/organizations/OrganizationsTable.svelte';

  const toastStore = getToastStore();
  const { allOrganizations } = $derived(administrationStore);

  let isLoading = $state(true);
  let error = $state<string | null>(null);

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-secondary-500))', start: 75, end: 50 }
  ];

  // Derived stores for different organization categories
  const organizationsByStatus = $derived({
    pending: allOrganizations.filter((org) => org.status?.status_type === 'pending'),
    accepted: allOrganizations.filter((org) => org.status?.status_type === 'accepted'),
    rejected: allOrganizations.filter((org) => org.status?.status_type === 'rejected'),
    temporarilySuspended: allOrganizations.filter(
      (org) => org.status?.status_type === 'suspended temporarily'
    ),
    indefinitelySuspended: allOrganizations.filter(
      (org) => org.status?.status_type === 'suspended indefinitely'
    )
  });

  const organizationCategories = $derived([
    {
      title: 'Pending Organizations',
      organizations: organizationsByStatus.pending,
      titleClass: 'text-primary-400'
    },
    {
      title: 'Accepted Organizations',
      organizations: organizationsByStatus.accepted,
      titleClass: 'text-green-600'
    },
    {
      title: 'Temporarily Suspended Organizations',
      organizations: organizationsByStatus.temporarilySuspended,
      titleClass: 'text-orange-600'
    },
    {
      title: 'Indefinitely Suspended Organizations',
      organizations: organizationsByStatus.indefinitelySuspended,
      titleClass: 'text-gray-600'
    },
    {
      title: 'Rejected Organizations',
      organizations: organizationsByStatus.rejected,
      titleClass: 'text-red-600'
    }
  ]);

  async function loadOrganizations() {
    try {
      isLoading = true;
      error = null;
      await administrationStore.fetchAllOrganizations();
      console.log('allOrganizations :', allOrganizations);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load organizations';
      const t = {
        message: 'Failed to load organizations. Please try again.',
        background: 'variant-filled-error',
        autohide: true,
        timeout: 5000
      };
      toastStore.trigger(t);
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    loadOrganizations();
  });
</script>

<section class="flex flex-col gap-10">
  <h1 class="h1 text-center">Organizations Management</h1>

  <div class="flex justify-center gap-4">
    <a href="/admin/organizations/status-history" class="btn variant-ghost-secondary w-fit">
      Status History
    </a>
    {#if !isLoading && error}
      <button class="btn variant-filled-primary" onclick={loadOrganizations}>
        Retry Loading
      </button>
    {/if}
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center gap-2">
      <ConicGradient stops={conicStops} spin />
      <p>Loading organizations...</p>
    </div>
  {:else if error}
    <div class="alert variant-filled-error">
      <span class="text-white">{error}</span>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
      {#each organizationCategories as { title, organizations, titleClass }}
        <div class="card p-4">
          <h3 class="h4 mb-4 {titleClass}">{title}</h3>
          <OrganizationsTable {organizations} />
        </div>
      {/each}
    </div>
  {/if}
</section>
