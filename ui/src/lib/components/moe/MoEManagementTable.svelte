<script lang="ts">
  import { TabGroup, Tab } from '@skeletonlabs/skeleton';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
  import type { ActionHash } from '@holochain/client';
  import { runEffect } from '$lib/utils/effect';

  let tabSet = $state(0);

  const {
    mediumsOfExchange,
    pendingMediumsOfExchange,
    approvedMediumsOfExchange,
    rejectedMediumsOfExchange,
    loading,
    error,
    getAllMediumsOfExchangeByStatus,
    approveMediumOfExchange,
    rejectMediumOfExchange
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

  const tableHeaders = ['Code', 'Name', 'hREA Resource ID', 'Actions'];

  function getTableData(tab: number): {
    data: UIMediumOfExchange[];
    status: 'pending' | 'approved' | 'rejected';
  } {
    switch (tab) {
      case 0:
        return { data: pendingMediumsOfExchange, status: 'pending' };
      case 1:
        return { data: approvedMediumsOfExchange, status: 'approved' };
      case 2:
        return { data: rejectedMediumsOfExchange, status: 'rejected' };
      default:
        return { data: [], status: 'pending' };
    }
  }

  let currentTable = $derived(getTableData(tabSet));
</script>

<div class="card p-4">
  <h3 class="h3 mb-4">Medium of Exchange Management</h3>

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
    <!-- --- -->
    <svelte:fragment slot="panel">
      {#if loading}
        <div class="p-4 text-center">Loading...</div>
      {:else if error}
        <div class="alert variant-filled-error"><p>{error}</p></div>
      {:else}
        <table class="table-hover table">
          <thead>
            <tr>
              {#each tableHeaders as header}
                <th>{header}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each currentTable.data as moe (moe.actionHash)}
              <tr>
                <td class="font-mono text-sm">{moe.code}</td>
                <td>{moe.name}</td>
                <td class="font-mono text-xs">
                  {moe.resourceSpecHreaId || 'Not assigned'}
                </td>
                <td class="space-y-2">
                  {#if currentTable.status === 'pending'}
                    <button
                      class="variant-filled-success btn btn-sm"
                      disabled={!moe.actionHash}
                      onclick={() => moe.actionHash && handleApprove(moe.actionHash)}
                    >
                      Approve
                    </button>
                    <button
                      class="variant-filled-error btn btn-sm ml-2"
                      disabled={!moe.actionHash}
                      onclick={() => moe.actionHash && handleReject(moe.actionHash)}
                    >
                      Reject
                    </button>
                  {/if}
                  {#if currentTable.status === 'approved'}
                    <span class="text-success-500 text-sm">✓ Approved</span>
                  {/if}
                  {#if currentTable.status === 'rejected'}
                    <div class="space-y-2">
                      <button
                        class="variant-filled-success btn btn-sm"
                        disabled={!moe.actionHash}
                        onclick={() => moe.actionHash && handleApprove(moe.actionHash)}
                      >
                        Approve
                      </button>
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if currentTable.data.length === 0}
          <p class="p-4 text-center">No mediums of exchange in this category.</p>
        {/if}
      {/if}
    </svelte:fragment>
  </TabGroup>

  <!-- Information section -->
  <div class="rounded-container-token bg-surface-100-800-token mt-6 p-4">
    <h4 class="h4 mb-2">About Mediums of Exchange</h4>
    <p class="text-surface-600-300-token text-sm">
      Mediums of exchange define how users can be compensated for their services. When approved,
      they become available for selection in offer and request forms. Each approved medium of
      exchange is automatically registered as a Resource Specification in the hREA system.
    </p>
  </div>
</div>
