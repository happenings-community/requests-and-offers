<script lang="ts">
  import { goto } from '$app/navigation';
  import { TabGroup, Tab, getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import MoEInitializer from '$lib/components/moe/MoEInitializer.svelte';
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
  import type { ActionHash } from '@holochain/client';
  import { runEffect } from '$lib/utils/effect';
  import { encodeHashToBase64 } from '@holochain/client';

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

  const tableHeaders = ['Code', 'Name', 'Status', 'Actions'];

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

  function getStatusBadgeClass(status: 'pending' | 'approved' | 'rejected'): string {
    switch (status) {
      case 'approved':
        return 'badge variant-filled-success';
      case 'pending':
        return 'badge variant-filled-warning';
      case 'rejected':
        return 'badge variant-filled-error';
      default:
        return 'badge variant-soft';
    }
  }
</script>

<svelte:head>
  <title>Manage Mediums of Exchange - Admin</title>
</svelte:head>

<div class="container mx-auto p-6">
  <!-- Header Section -->
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="h1 text-3xl font-bold">Manage Mediums of Exchange</h1>
      <p class="text-surface-600 dark:text-surface-400 mt-2">
        Create, review, and manage mediums of exchange. Approve currencies to make them available
        for users when creating offers and requests.
      </p>
    </div>
    <button
      class="btn variant-filled-primary"
      onclick={() => goto('/admin/mediums-of-exchange/create')}
    >
      <span>+</span>
      Create New
    </button>
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
            <div class="table-container">
              <table class="table-hover table">
                <thead>
                  <tr>
                    {#each tableHeaders as header}
                      <th class="font-semibold">{header}</th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each currentTable.data as moe (moe.actionHash)}
                    <tr>
                      <td class="font-mono text-sm font-bold">
                        <a 
                          href="/mediums-of-exchange/{encodeHashToBase64(moe.actionHash)}" 
                          class="text-primary-400 hover:text-primary-500 hover:underline"
                        >
                          {moe.code}
                        </a>
                      </td>
                      <td class="font-medium">
                        <a 
                          href="/mediums-of-exchange/{encodeHashToBase64(moe.actionHash)}" 
                          class="text-primary-400 hover:text-primary-500 hover:underline"
                        >
                          {moe.name}
                        </a>
                      </td>
                      <td>
                        <span class={getStatusBadgeClass(moe.status)}>
                          {moe.status.charAt(0).toUpperCase() + moe.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <div class="flex items-center gap-2">
                          <!-- Status Management Actions -->
                          {#if moe.status === 'pending'}
                            <button
                              class="btn btn-sm variant-filled-success"
                              disabled={!moe.actionHash}
                              onclick={() => moe.actionHash && handleApprove(moe.actionHash)}
                              title="Approve this medium of exchange"
                            >
                              Approve
                            </button>
                            <button
                              class="btn btn-sm variant-filled-error"
                              disabled={!moe.actionHash}
                              onclick={() => moe.actionHash && handleReject(moe.actionHash)}
                              title="Reject this medium of exchange"
                            >
                              Reject
                            </button>
                          {:else if moe.status === 'rejected'}
                            <button
                              class="btn btn-sm variant-filled-success"
                              disabled={!moe.actionHash}
                              onclick={() => moe.actionHash && handleApprove(moe.actionHash)}
                              title="Approve this medium of exchange"
                            >
                              Approve
                            </button>
                          {/if}

                          <!-- CRUD Actions -->
                          <div class="divider-vertical h-6"></div>

                          <button
                            class="btn btn-sm variant-soft"
                            onclick={() => handleEdit(moe)}
                            title="Edit this medium of exchange"
                          >
                            Edit
                          </button>

                          <button
                            class="btn btn-sm variant-filled-error"
                            onclick={() => handleDelete(moe)}
                            title="Delete this medium of exchange"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>

              {#if currentTable.data.length === 0}
                <div class="p-8 text-center">
                  <div class="text-surface-500 mb-4">
                    <svg
                      class="mx-auto mb-4 h-16 w-16 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                      ></path>
                    </svg>
                  </div>
                  <h3 class="h3 mb-2">No mediums of exchange found</h3>
                  <p class="text-surface-600 dark:text-surface-400 mb-4">
                    {#if currentTable.status === 'all'}
                      There are no mediums of exchange in the system yet.
                    {:else}
                      No mediums of exchange with "{currentTable.status}" status.
                    {/if}
                  </p>
                  {#if currentTable.status === 'all'}
                    <button
                      class="btn variant-filled-primary"
                      onclick={() => goto('/admin/mediums-of-exchange/create')}
                    >
                      Create First Medium of Exchange
                    </button>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </svelte:fragment>
      </TabGroup>
    </section>

    <!-- Information Footer -->
    <footer class="card-footer bg-surface-100-800-token">
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
