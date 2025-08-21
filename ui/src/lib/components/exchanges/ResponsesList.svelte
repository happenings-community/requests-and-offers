<!-- ResponsesList.svelte - List of exchange responses -->
<script lang="ts">
  import type { UIExchangeResponse } from '$lib/services/zomes/exchanges.service';
  import { encodeHashToBase64 } from '@holochain/client';

  interface Props {
    responses: UIExchangeResponse[];
    showActions?: boolean;
    onAction?: (action: string, responseId: string) => void;
    compact?: boolean;
    showFilters?: boolean;
    showDirection?: boolean; // Show incoming/outgoing indicator
    currentUserPubkey?: string; // To determine direction
  }

  const {
    responses,
    showActions = false,
    onAction,
    compact = false,
    showFilters = false,
    showDirection = false,
    currentUserPubkey
  }: Props = $props();

  // Helper to determine if response is incoming or outgoing
  const getResponseDirection = (response: UIExchangeResponse) => {
    if (!showDirection || !currentUserPubkey) return null;
    return response.proposerPubkey === currentUserPubkey ? 'outgoing' : 'incoming';
  };

  // Filtering state
  let statusFilter = $state<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
  let searchTerm = $state('');

  // Filtered responses
  const filteredResponses = $derived.by(() => {
    let filtered = responses;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((response) => response.entry.status === statusFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (response) =>
          response.entry.service_details.toLowerCase().includes(term) ||
          (response.entry.terms && response.entry.terms.toLowerCase().includes(term))
      );
    }

    return filtered;
  });
</script>

<div class="space-y-4">
  {#if showFilters}
    <!-- Filters -->
    <div class="card p-4">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <!-- Status filter -->
        <div class="flex items-center gap-2">
          <label for="status-filter" class="text-sm font-medium">Status:</label>
          <select id="status-filter" bind:value={statusFilter} class="select w-auto">
            <option value="all">All</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <!-- Search filter -->
        <div class="flex items-center gap-2">
          <label for="search-filter" class="text-sm font-medium">Search:</label>
          <input
            id="search-filter"
            type="text"
            bind:value={searchTerm}
            placeholder="Search responses..."
            class="input w-48"
          />
        </div>

        <!-- Results count -->
        <div class="text-sm text-surface-600 dark:text-surface-400">
          Showing {filteredResponses.length} of {responses.length} responses
        </div>
      </div>
    </div>
  {/if}

  <!-- Responses list -->
  <div class="space-y-2">
    {#if filteredResponses.length === 0}
      <div class="py-8 text-center text-surface-600 dark:text-surface-400">
        {responses.length === 0 ? 'No responses found.' : 'No responses match your filters.'}
      </div>
    {:else}
      {#each filteredResponses as response}
        <div class="card" class:p-4={!compact} class:p-2={compact}>
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="space-y-2">
                <!-- Direction and Status Header -->
                <div class="flex flex-wrap items-center gap-2">
                  {#if showDirection}
                    {@const direction = getResponseDirection(response)}
                    {#if direction === 'outgoing'}
                      <span class="variant-soft-primary badge text-xs"> 📤 My Proposal </span>
                    {:else if direction === 'incoming'}
                      <span class="variant-soft-secondary badge text-xs">
                        📥 Received Proposal
                      </span>
                    {/if}
                  {/if}

                  <span
                    class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium variant-soft-{response
                      .entry.status === 'Pending'
                      ? 'warning'
                      : response.entry.status === 'Approved'
                        ? 'success'
                        : 'error'}"
                  >
                    {response.entry.status}
                  </span>
                </div>

                <!-- Service Details -->
                <a
                  href="/exchanges/proposal/{encodeHashToBase64(response.actionHash)}"
                  class="block transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                >
                  <h4 class="font-medium">{response.entry.service_details}</h4>
                </a>

                <!-- Exchange Details -->
                <div class="flex items-center gap-4 text-xs text-surface-500">
                  <span>💱 {response.entry.exchange_medium}</span>
                  {#if response.entry.exchange_value}
                    <span>💰 {response.entry.exchange_value}</span>
                  {/if}
                  {#if response.entry.delivery_timeframe}
                    <span>⏱️ {response.entry.delivery_timeframe}</span>
                  {/if}
                </div>

                <!-- Action Links -->
                <div class="flex gap-3 text-xs">
                  <a
                    href="/exchanges/proposal/{encodeHashToBase64(response.actionHash)}"
                    class="text-primary-500 hover:text-primary-400"
                  >
                    View Details →
                  </a>
                  <!-- TODO: Populate targetEntityHash from backend links -->
                </div>
              </div>
            </div>

            {#if showActions && onAction}
              <div class="flex gap-2">
                {#if response.entry.status === 'Pending'}
                  <button
                    class="variant-filled-success btn btn-sm"
                    onclick={() => onAction?.('approve', response.actionHash.toString())}
                  >
                    Approve
                  </button>
                  <button
                    class="variant-filled-error btn btn-sm"
                    onclick={() => onAction?.('reject', response.actionHash.toString())}
                  >
                    Reject
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
