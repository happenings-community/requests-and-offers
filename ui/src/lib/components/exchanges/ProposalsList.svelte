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
    <div class="py-8 text-center text-surface-600 dark:text-surface-400">No proposals found.</div>
  {:else}
    {#each proposals as proposal}
      <div class="card" class:p-4={!compact} class:p-2={compact}>
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <a
              href="/exchanges/proposal/{proposal.actionHash.toString()}"
              class="block transition-colors hover:text-primary-600 dark:hover:text-primary-400"
            >
              <h4 class="font-medium">{proposal.entry.service_details}</h4>
              <p class="text-sm text-surface-600 dark:text-surface-400">
                Status: <span
                  class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium variant-soft-{proposal
                    .entry.status === 'Pending'
                    ? 'warning'
                    : proposal.entry.status === 'Approved'
                      ? 'success'
                      : 'error'}"
                >
                  {proposal.entry.status}
                </span>
              </p>
              <p class="mt-1 text-xs text-surface-500 dark:text-surface-500">
                Click to view details
              </p>
            </a>
          </div>

          {#if showActions && onAction}
            <div class="flex gap-2">
              {#if proposal.entry.status === 'Pending'}
                <button
                  class="variant-filled-success btn btn-sm"
                  onclick={() => onAction?.('approve', proposal.actionHash.toString())}
                >
                  Approve
                </button>
                <button
                  class="variant-filled-error btn btn-sm"
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
