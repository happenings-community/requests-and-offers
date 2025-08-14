<!-- AgreementsList.svelte - List of exchange agreements -->
<script lang="ts">
  import type { UIAgreement } from '$lib/services/zomes/exchanges.service';

  interface Props {
    agreements: UIAgreement[];
    showActions?: boolean;
    onAction?: (action: string, agreementId: string) => void;
    compact?: boolean;
  }

  const { agreements, showActions = false, onAction, compact = false }: Props = $props();
</script>

<div class="space-y-2">
  {#if agreements.length === 0}
    <div class="py-8 text-center text-surface-600 dark:text-surface-400">No agreements found.</div>
  {:else}
    {#each agreements as agreement}
      <div class="card" class:p-4={!compact} class:p-2={compact}>
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <a
              href="/exchanges/agreement/{agreement.actionHash.toString()}"
              class="block transition-colors hover:text-primary-600 dark:hover:text-primary-400"
            >
              <h4 class="font-medium">{agreement.entry.service_details}</h4>
              <p class="text-sm text-surface-600 dark:text-surface-400">
                Status: <span
                  class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium variant-soft-{agreement
                    .entry.status === 'Active'
                    ? 'warning'
                    : 'success'}"
                >
                  {agreement.entry.status}
                </span>
              </p>
              <div class="mt-1 text-xs text-surface-500 dark:text-surface-500">
                Provider: {agreement.entry.provider_completed ? '✅' : '⏳'} | Receiver: {agreement
                  .entry.receiver_completed
                  ? '✅'
                  : '⏳'}
              </div>
              <p class="mt-1 text-xs text-surface-500 dark:text-surface-500">
                Click to view details
              </p>
            </a>
          </div>

          {#if showActions && onAction}
            <div class="flex gap-2">
              {#if agreement.entry.status === 'Active'}
                <button
                  class="variant-filled-primary btn btn-sm"
                  onclick={() => onAction?.('mark_complete', agreement.actionHash.toString())}
                >
                  Mark Complete
                </button>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>
