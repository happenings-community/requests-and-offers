<script lang="ts">
  import { goto } from '$app/navigation';
  import { TabGroup, Tab, getModalStore } from '@skeletonlabs/skeleton';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
  import type { ActionHash } from '@holochain/client';
  import { runEffect } from '$lib/utils/effect';
  import { encodeHashToBase64 } from '@holochain/client';
  import MediumsOfExchangeTable from '@/lib/components/mediums-of-exchange/MediumsOfExchangeTable.svelte';
  import MoEInitializer from '@/lib/components/mediums-of-exchange/MoEInitializer.svelte';

  const modalStore = getModalStore();
  let tabSet = $state(1);

  const {
    mediumsOfExchange,
    pendingMediumsOfExchange,
    approvedMediumsOfExchange,
    rejectedMediumsOfExchange,
    loading,
    error,
    getAllMediumsOfExchangeByStatus,
    approveMediumOfExchange,
    rejectMediumOfExchange,
    deleteMediumOfExchange
  } = mediumsOfExchangeStore;

  $effect(() => {
    // Fetch all statuses when the component mounts
    runEffect(getAllMediumsOfExchangeByStatus());
  });

  const handleApprove = (hash: ActionHash) => {
    runEffect(approveMediumOfExchange(hash));
  };

  const handleReject = (hash: ActionHash) => {
    runEffect(rejectMediumOfExchange(hash));
  };

  const handleEdit = (mediumOfExchange: UIMediumOfExchange) => {
    const encodedHash = encodeHashToBase64(mediumOfExchange.actionHash);
    goto(`/admin/mediums-of-exchange/${encodedHash}/edit`);
  };

  const handleDelete = (mediumOfExchange: UIMediumOfExchange) => {
    modalStore.trigger({
      type: 'confirm',
      title: 'Delete Medium of Exchange',
      body: `Are you sure you want to delete "${mediumOfExchange.name}" (${mediumOfExchange.code})? This action cannot be undone.`,
      response: (confirmed: boolean) => {
        if (confirmed && mediumOfExchange.actionHash) {
          runEffect(deleteMediumOfExchange(mediumOfExchange.actionHash));
        }
      }
    });
  };

  function getTableData(tab: number): {
    data: UIMediumOfExchange[];
    status: 'pending' | 'approved' | 'rejected' | 'all';
  } {
    switch (tab) {
      case 0:
        return { data: pendingMediumsOfExchange, status: 'pending' };
      case 1:
        return { data: approvedMediumsOfExchange, status: 'approved' };
      case 2:
        return { data: rejectedMediumsOfExchange, status: 'rejected' };
      case 3:
        return { data: mediumsOfExchange, status: 'all' };
      default:
        return { data: [], status: 'pending' };
    }
  }

  let currentTable = $derived(getTableData(tabSet));
</script>

<svelte:head>
  <title>Manage Mediums of Exchange - Admin</title>
</svelte:head>

<div class="container mx-auto p-6">
  <!-- Header Section -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="h1 text-3xl font-bold">Manage Mediums of Exchange</h1>
      <p class="mt-2 text-surface-600 dark:text-surface-400">
        Create, review, and manage mediums of exchange. Approve currencies to make them available
        for users when creating offers and requests.
      </p>
    </div>
    <div class="flex gap-2">
      <button
        class="variant-filled-secondary btn btn-sm"
        onclick={() => {
          mediumsOfExchangeStore.invalidateCache();
          runEffect(getAllMediumsOfExchangeByStatus());
        }}
        title="Force refresh data from DHT"
      >
        🔄 Refresh
      </button>
      <button
        class="variant-filled-primary btn"
        onclick={() => goto('/admin/mediums-of-exchange/create')}
      >
        Create New
      </button>
    </div>
  </div>

  <!-- Initialization Component -->
  <div class="mb-6">
    <MoEInitializer />
  </div>

  <!-- Main Management Interface -->
  <div class="card">
    <header class="card-header">
      <h2 class="h2 text-xl font-semibold">Medium of Exchange Management</h2>
    </header>

    <section class="p-4">
      <TabGroup>
        <Tab bind:group={tabSet} name="pending" value={0}>
          Pending ({pendingMediumsOfExchange.length})
        </Tab>
        <Tab bind:group={tabSet} name="approved" value={1}>
          Approved ({approvedMediumsOfExchange.length})
        </Tab>
        <Tab bind:group={tabSet} name="rejected" value={2}>
          Rejected ({rejectedMediumsOfExchange.length})
        </Tab>
        <Tab bind:group={tabSet} name="all" value={3}>
          All ({mediumsOfExchange.length})
        </Tab>

        <!-- Tab Content -->
        <svelte:fragment slot="panel">
          {#if loading}
            <div class="p-8 text-center">
              <div class="loading loading-spinner loading-lg mx-auto mb-4"></div>
              <p>Loading mediums of exchange...</p>
            </div>
          {:else if error}
            <div class="alert variant-filled-error">
              <div class="alert-message">
                <h3 class="h3">Error</h3>
                <p>{error}</p>
              </div>
            </div>
          {:else}
            <MediumsOfExchangeTable
              data={currentTable.data}
              status={currentTable.status}
              onApprove={handleApprove}
              onReject={handleReject}
              onEdit={handleEdit}
              onDelete={handleDelete}
            >
              {#snippet emptyStateAction()}
                <button
                  class="variant-filled-primary btn"
                  onclick={() => goto('/admin/mediums-of-exchange/create')}
                >
                  Create First Medium of Exchange
                </button>
              {/snippet}
            </MediumsOfExchangeTable>
          {/if}
        </svelte:fragment>
      </TabGroup>
    </section>

    <!-- Information Footer -->
    <footer class="bg-surface-100-800-token card-footer">
      <div class="space-y-3">
        <h4 class="h4 font-semibold">About Mediums of Exchange</h4>
        <div class="text-surface-600-300-token grid gap-4 text-sm md:grid-cols-2">
          <div>
            <p class="mb-1 font-medium">Status Workflow:</p>
            <ul class="list-inside list-disc space-y-1 text-xs">
              <li><strong>Pending:</strong> Awaiting admin review</li>
              <li><strong>Approved:</strong> Available for users in offers/requests</li>
              <li><strong>Rejected:</strong> Hidden from users, can be re-approved</li>
            </ul>
          </div>
          <div>
            <p class="mb-1 font-medium">Features:</p>
            <ul class="list-inside list-disc space-y-1 text-xs">
              <li>Create new currencies or payment methods</li>
              <li>Edit existing mediums of exchange</li>
              <li>Approve/reject user suggestions</li>
              <li>Automatic hREA Resource Specification integration</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  </div>
</div>
