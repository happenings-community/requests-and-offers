<!-- ProposalsList.svelte - List of exchange proposals -->
<script lang="ts">
  import type { UIExchangeProposal } from '$lib/services/zomes/exchanges.service';

  interface Props {
    proposals: UIExchangeProposal[];
    showActions?: boolean;
    onAction?: (action: string, proposalId: string) => void;
    compact?: boolean;
  }

  const { proposals, showActions = false, onAction, compact = false }: Props = $props();
</script>

<div class="space-y-2">
  {#if proposals.length === 0}
    <div class="text-center py-8 text-surface-600 dark:text-surface-400">
      No proposals found.
    </div>
  {:else}
    {#each proposals as proposal}
      <div class="card p-4" class:compact>
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <a 
              href="/exchanges/proposal/{proposal.actionHash.toString()}"
              class="block hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <h4 class="font-medium">{proposal.entry.service_details}</h4>
              <p class="text-sm text-surface-600 dark:text-surface-400">
                Status: <span class="badge variant-soft-{proposal.entry.status === 'Pending' ? 'warning' : proposal.entry.status === 'Approved' ? 'success' : 'error'}">
                  {proposal.entry.status}
                </span>
              </p>
              <p class="text-xs text-surface-500 dark:text-surface-500 mt-1">
                Click to view details
              </p>
            </a>
          </div>
          
          {#if showActions && onAction}
            <div class="flex gap-2">
              {#if proposal.entry.status === 'Pending'}
                <button
                  class="btn btn-sm variant-filled-success"
                  onclick={() => onAction?.('approve', proposal.actionHash.toString())}
                >
                  Approve
                </button>
                <button
                  class="btn btn-sm variant-filled-error"
                  onclick={() => onAction?.('reject', proposal.actionHash.toString())}
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

<style>
  .compact {
    @apply p-2;
  }
  
  .badge {
    @apply inline-flex items-center px-2 py-1 rounded-full text-xs font-medium;
  }
</style>