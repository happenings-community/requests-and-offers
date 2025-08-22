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

  // Debug responses data
  $effect(() => {
    if (responses && responses.length > 0) {
      const firstResponse = $state.snapshot(responses[0]);
      console.log('🔍 Debug - ResponsesList received responses:', $state.snapshot(responses));
      console.log('🔍 Debug - First response full object:', firstResponse);
      console.log('🔍 Debug - First response entry details:', firstResponse?.entry);
      console.log('🔍 Debug - Entry service_details:', firstResponse?.entry?.service_details);
      console.log('🔍 Debug - Response status:', firstResponse?.status);
      console.log('🔍 Debug - Entry fields:', Object.keys(firstResponse?.entry || {}));
    }
  });

  // Filtered responses
  const filteredResponses = $derived.by(() => {
    let filtered = responses;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((response) => response.status === statusFilter);
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (response) =>
          (response.entry.service_details && response.entry.service_details.toLowerCase().includes(term)) ||
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
          <!-- Debug info for development -->
          {#if import.meta.env.DEV}
            <details class="mb-2 text-xs">
              <summary class="cursor-pointer text-surface-500">Debug Info</summary>
              <pre class="mt-2 overflow-x-auto text-xs text-surface-400">
{JSON.stringify(response, null, 2)}
              </pre>
            </details>
          {/if}
          
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="space-y-3">
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

                  {#if response.status === 'Pending'}
                    <span class="variant-soft-warning badge text-xs">
                      {response.status}
                    </span>
                  {:else if response.status === 'Approved'}
                    <span class="variant-soft-success badge text-xs">
                      {response.status}
                    </span>
                  {:else if response.status === 'Rejected'}
                    <span class="variant-soft-error badge text-xs">
                      {response.status}
                    </span>
                  {:else}
                    <span class="variant-soft-secondary badge text-xs">
                      Unknown Status
                    </span>
                  {/if}
                </div>

                <!-- Service Details -->
                <div>
                  {#if response.actionHash}
                    <a
                      href="/exchanges/proposal/{encodeHashToBase64(response.actionHash)}"
                      class="block transition-colors hover:text-primary-600 dark:hover:text-primary-400"
                    >
                      <h4 class="font-medium text-sm">
                        {response.entry?.service_details || 'No service details provided'}
                      </h4>
                    </a>
                  {:else}
                    <h4 class="font-medium text-sm">
                      {response.entry?.service_details?.trim() || 'No service details provided'}
                    </h4>
                  {/if}
                </div>

                <!-- Terms -->
                {#if response.entry?.terms}
                  <div class="text-sm text-surface-600 dark:text-surface-400">
                    <span class="font-medium">Terms:</span> {response.entry.terms}
                  </div>
                {/if}

                <!-- Exchange Details -->
                <div class="flex flex-wrap items-center gap-3 text-xs text-surface-500">
                  <span>💱 {response.entry?.exchange_medium || 'Not specified'}</span>
                  {#if response.entry?.exchange_value}
                    <span>💰 {response.entry.exchange_value}</span>
                  {/if}
                  {#if response.entry?.delivery_timeframe}
                    <span>⏱️ {response.entry.delivery_timeframe}</span>
                  {/if}
                </div>

                <!-- Notes -->
                {#if response.entry?.notes}
                  <div class="text-xs text-surface-500">
                    <span class="font-medium">Notes:</span> {response.entry.notes}
                  </div>
                {/if}

                <!-- Action Links -->
                <div class="flex gap-3 text-xs">
                  {#if response.actionHash}
                    <a
                      href="/exchanges/proposal/{encodeHashToBase64(response.actionHash)}"
                      class="text-primary-500 hover:text-primary-400"
                    >
                      View Details →
                    </a>
                  {:else}
                    <span class="text-surface-400">Invalid proposal ID</span>
                  {/if}
                </div>
              </div>
            </div>

            {#if showActions && onAction}
              <div class="flex flex-col gap-2 sm:flex-row">
                {#if response.status === 'Pending'}
                  {@const direction = getResponseDirection(response)}
                  {#if direction === 'incoming'}
                    <!-- Only show approve/reject for incoming responses -->
                    <button
                      class="variant-filled-success btn btn-sm"
                      onclick={() => onAction?.('approve', response.actionHash?.toString())}
                    >
                      Approve
                    </button>
                    <button
                      class="variant-filled-error btn btn-sm"
                      onclick={() => onAction?.('reject', response.actionHash?.toString())}
                    >
                      Reject
                    </button>
                  {:else}
                    <!-- For outgoing responses, show status info -->
                    <div class="text-xs text-surface-500 p-2">
                      Awaiting response
                    </div>
                  {/if}
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>
