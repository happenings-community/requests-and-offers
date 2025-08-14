<script lang="ts">
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
  import type { ActionHash } from '@holochain/client';

  interface Props {
    data: UIMediumOfExchange[];
    status: 'pending' | 'approved' | 'rejected' | 'all';
    onApprove?: (hash: ActionHash) => void;
    onReject?: (hash: ActionHash) => void;
    onEdit?: (moe: UIMediumOfExchange) => void;
    onDelete?: (moe: UIMediumOfExchange) => void;
    emptyStateAction?: import('svelte').Snippet;
    children?: import('svelte').Snippet;
  }

  let { data, status, onApprove, onReject, onEdit, onDelete, emptyStateAction, children }: Props =
    $props();

  // Debug logging to help troubleshoot the issue
  $effect(() => {
    console.log(`MediumsOfExchangeTable [${status}]:`, {
      count: data.length,
      data: data.map((moe) => ({ code: moe.code, name: moe.name, status: moe.status }))
    });
  });

  type SortField = 'code' | 'name' | 'type' | 'status';
  type SortDirection = 'asc' | 'desc';

  let sortField = $state<SortField>('type');
  let sortDirection = $state<SortDirection>('asc');

  const tableHeaders = [
    { key: 'code' as SortField, label: 'Code', sortable: true },
    { key: 'name' as SortField, label: 'Name', sortable: true },
    { key: 'type' as SortField, label: 'Type', sortable: true },
    { key: 'status' as SortField, label: 'Status', sortable: true },
    { key: null, label: 'Actions', sortable: false }
  ];

  let sortedData = $derived.by((): UIMediumOfExchange[] => {
    const sorted = [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'code':
          aValue = a.code;
          bValue = b.code;
          break;
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'type':
          // Base MoEs first, then currency
          aValue = a.exchange_type === 'base' ? 0 : 1;
          bValue = b.exchange_type === 'base' ? 0 : 1;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
  }

  function getSortIcon(field: SortField): string {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

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

  function getExchangeTypeDisplay(exchangeType: 'base' | 'currency'): {
    icon: string;
    label: string;
    class: string;
  } {
    if (exchangeType === 'base') {
      return {
        icon: '📂',
        label: 'Base',
        class: 'badge variant-soft-primary'
      };
    } else {
      return {
        icon: '💰',
        label: 'Currency',
        class: 'badge variant-soft-secondary'
      };
    }
  }
</script>

<div class="table-container">
  <table class="table table-hover">
    <thead>
      <tr>
        {#each tableHeaders as header}
          <th class="font-semibold">
            {#if header.sortable && header.key}
              <button
                class="flex items-center gap-1 hover:text-primary-300 focus:text-primary-300 focus:outline-none"
                onclick={() => handleSort(header.key!)}
                title="Sort by {header.label}"
              >
                {header.label}
                <span class="">{getSortIcon(header.key!)}</span>
              </button>
            {:else}
              {header.label}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each sortedData as moe (moe.actionHash)}
        {@const typeDisplay = getExchangeTypeDisplay(moe.exchange_type)}
        <tr>
          <td class="font-mono text-sm font-bold text-primary-400">
            {moe.code}
          </td>
          <td class="font-medium">
            {moe.name}
          </td>
          <td>
            <span class={typeDisplay.class}>
              {typeDisplay.icon}
              {typeDisplay.label}
            </span>
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
                  class="variant-filled-success btn btn-sm"
                  disabled={!moe.actionHash}
                  onclick={() => moe.actionHash && onApprove?.(moe.actionHash)}
                  title="Approve this medium of exchange"
                >
                  Approve
                </button>
                <button
                  class="variant-filled-error btn btn-sm"
                  disabled={!moe.actionHash}
                  onclick={() => moe.actionHash && onReject?.(moe.actionHash)}
                  title="Reject this medium of exchange"
                >
                  Reject
                </button>
              {:else if moe.status === 'rejected'}
                <button
                  class="variant-filled-success btn btn-sm"
                  disabled={!moe.actionHash}
                  onclick={() => moe.actionHash && onApprove?.(moe.actionHash)}
                  title="Approve this medium of exchange"
                >
                  Approve
                </button>
              {/if}

              <!-- CRUD Actions -->
              <div class="divider-vertical h-6"></div>

              <button
                class="variant-soft btn btn-sm"
                onclick={() => onEdit?.(moe)}
                title="Edit this medium of exchange"
              >
                Edit
              </button>

              <button
                class="variant-filled-error btn btn-sm"
                onclick={() => onDelete?.(moe)}
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

  {#if sortedData.length === 0}
    <div class="p-8 text-center">
      <div class="mb-4 text-surface-500">
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
      <p class="mb-4 text-surface-600 dark:text-surface-400">
        {#if status === 'all'}
          There are no mediums of exchange in the system yet.
        {:else}
          No mediums of exchange with "{status}" status.
        {/if}
      </p>
      {#if status === 'all'}
        {#if emptyStateAction}
          {@render emptyStateAction()}
        {:else if children}
          {@render children()}
        {/if}
      {/if}
    </div>
  {/if}
</div>
