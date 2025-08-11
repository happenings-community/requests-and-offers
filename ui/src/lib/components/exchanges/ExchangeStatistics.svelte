<!-- ExchangeStatistics.svelte - Display exchange statistics -->
<script lang="ts">
  import type { ReviewStatistics } from '$lib/services/zomes/exchanges.service';

  interface Props {
    stats: ReviewStatistics;
    totalProposals: number;
    totalAgreements: number;
  }

  const { stats, totalProposals, totalAgreements }: Props = $props();
</script>

<div class="card p-6">
  <h3 class="h4 font-semibold mb-4">Exchange Statistics</h3>
  
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
    <div class="text-center">
      <div class="text-2xl font-bold text-primary-500">{totalProposals}</div>
      <div class="text-sm text-surface-600 dark:text-surface-400">Total Proposals</div>
    </div>
    
    <div class="text-center">
      <div class="text-2xl font-bold text-warning-500">{totalAgreements}</div>
      <div class="text-sm text-surface-600 dark:text-surface-400">Total Agreements</div>
    </div>
    
    <div class="text-center">
      <div class="text-2xl font-bold text-success-500">{stats.total_completed_exchanges}</div>
      <div class="text-sm text-surface-600 dark:text-surface-400">Completed</div>
    </div>
    
    <div class="text-center">
      <div class="text-2xl font-bold text-secondary-500">{stats.average_rating.toFixed(1)}</div>
      <div class="text-sm text-surface-600 dark:text-surface-400">Avg Rating</div>
    </div>
    
    <div class="text-center">
      <div class="text-2xl font-bold text-tertiary-500">{stats.total_completed_exchanges}</div>
      <div class="text-sm text-surface-600 dark:text-surface-400">Completed</div>
    </div>
  </div>
  
  {#if stats.total_reviews > 0}
    <div class="mt-4 pt-4 border-t border-surface-300 dark:border-surface-700">
      <div class="flex justify-between text-sm">
        <span>Reviews given: {stats.total_reviews}</span>
        <span>Exchanges completed: {stats.total_completed_exchanges}</span>
      </div>
    </div>
  {/if}
</div>