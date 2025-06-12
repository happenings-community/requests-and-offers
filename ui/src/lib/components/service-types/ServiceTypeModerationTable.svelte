<script lang="ts">
  import { TabGroup, Tab } from '@skeletonlabs/skeleton';
  import { Effect as E, pipe } from 'effect';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import type { UIServiceType } from '$lib/types/ui';
  import type { ActionHash } from '@holochain/client';

  let tabSet = $state(0);

  const {
    pendingServiceTypes,
    approvedServiceTypes,
    rejectedServiceTypes,
    loading,
    error,
    getPendingServiceTypes,
    getApprovedServiceTypes,
    getRejectedServiceTypes,
    approveServiceType,
    rejectServiceType
  } = serviceTypesStore;

  $effect(() => {
    // Fetch all statuses when the component mounts
    const fetchAll = E.all([
      getPendingServiceTypes(),
      getApprovedServiceTypes(),
      getRejectedServiceTypes()
    ]);

    pipe(fetchAll, E.runPromise);
  });

  const handleApprove = (hash: ActionHash) => {
    pipe(approveServiceType(hash), E.runPromise);
  };

  const handleReject = (hash: ActionHash) => {
    pipe(rejectServiceType(hash), E.runPromise);
  };

  const tableHeaders = ['Name', 'Description', 'Tags', 'Actions'];

  function getTableData(tab: number): { data: UIServiceType[], status: 'pending' | 'approved' | 'rejected' } {
    switch (tab) {
      case 0:
        return { data: pendingServiceTypes, status: 'pending' };
      case 1:
        return { data: approvedServiceTypes, status: 'approved' };
      case 2:
        return { data: rejectedServiceTypes, status: 'rejected' };
      default:
        return { data: [], status: 'pending' };
    }
  }

  let currentTable = $derived(getTableData(tabSet));
</script>

<div class="card p-4">
  <h3 class="h3 mb-4">Service Type Moderation</h3>

  <TabGroup>
    <Tab bind:group={tabSet} name="pending" value={0}>Pending ({pendingServiceTypes.length})</Tab>
    <Tab bind:group={tabSet} name="approved" value={1}>Approved ({approvedServiceTypes.length})</Tab>
    <Tab bind:group={tabSet} name="rejected" value={2}>Rejected ({rejectedServiceTypes.length})</Tab>
    <!-- --- -->
    <svelte:fragment slot="panel">
      {#if loading}
        <div class="p-4 text-center">Loading...</div>
      {:else if error}
        <div class="alert variant-filled-error"><p>{error}</p></div>
      {:else}
        <table class="table table-hover">
          <thead>
            <tr>
              {#each tableHeaders as header}
                <th>{header}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each currentTable.data as st (st.original_action_hash)}
              <tr>
                <td>{st.name}</td>
                <td>{st.description}</td>
                <td>{st.tags.join(', ')}</td>
                <td>
                  {#if currentTable.status === 'pending'}
                    <button class="btn btn-sm variant-filled-success" disabled={!st.original_action_hash} onclick={() => st.original_action_hash && handleApprove(st.original_action_hash)}>Approve</button>
                    <button class="btn btn-sm variant-filled-error ml-2" disabled={!st.original_action_hash} onclick={() => st.original_action_hash && handleReject(st.original_action_hash)}>Reject</button>
                  {/if}
                  {#if currentTable.status === 'approved'}
                     <!-- No direct reject on approved; must revert to pending first -->
                     <span class="text-surface-500 text-xs">Already approved</span>
                  {/if}
                  {#if currentTable.status === 'rejected'}
                     <button class="btn btn-sm variant-filled-success" disabled={!st.original_action_hash} onclick={() => st.original_action_hash && handleApprove(st.original_action_hash)}>Approve</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if currentTable.data.length === 0}
          <p class="text-center p-4">No service types in this category.</p>
        {/if}
      {/if}
    </svelte:fragment>
  </TabGroup>
</div>
