<script lang="ts">
  import { onMount } from 'svelte';
  import type { ActionHash } from '@holochain/client';
  import type { UIUser } from '$lib/types/ui';
  import { useExchangeFeedbackManagement } from '$lib/composables/domain/exchanges';
  import type { ReviewStats } from '$lib/composables/domain/exchanges/useExchangeFeedbackManagement.svelte';

  // Props
  interface Props {
    user: UIUser;
    userHash: ActionHash;
    compact?: boolean;
    showDetails?: boolean;
  }

  let { user, userHash, compact = false, showDetails = false }: Props = $props();

  // Composable
  const feedbackManager = useExchangeFeedbackManagement();

  // State
  let userStats: ReviewStats | null = $state(null);
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let showDetailedStats = $state(showDetails);

  // Derived values
  const hasStats = $derived.by(() => userStats && userStats.totalReviews > 0);
  const averageRating = $derived.by(() => userStats?.averageRating || 0);
  const totalReviews = $derived.by(() => userStats?.totalReviews || 0);
  const onTimePercentage = $derived.by(() => userStats?.completedOnTimePercentage || 0);
  const asAgreedPercentage = $derived.by(() => userStats?.completedAsAgreedPercentage || 0);

  // Star display helper
  function getStarDisplay(rating: number): Array<{ type: 'full' | 'half' | 'empty' }> {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.5;

    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars.push({ type: 'full' as const });
    }

    // Half star
    if (hasHalfStar) {
      stars.push({ type: 'half' as const });
    }

    // Empty stars
    const remaining = 5 - stars.length;
    for (let i = 0; i < remaining; i++) {
      stars.push({ type: 'empty' as const });
    }

    return stars;
  }

  // Rating color helper
  function getRatingColor(rating: number): string {
    if (rating >= 4.5) return 'text-success-500';
    if (rating >= 4.0) return 'text-success-400';
    if (rating >= 3.5) return 'text-warning-500';
    if (rating >= 3.0) return 'text-warning-600';
    return 'text-error-500';
  }

  // Rating description helper
  function getRatingDescription(rating: number): string {
    if (rating >= 4.5) return 'Excellent';
    if (rating >= 4.0) return 'Very Good';
    if (rating >= 3.5) return 'Good';
    if (rating >= 3.0) return 'Fair';
    return 'Needs Improvement';
  }

  // Performance badge helper
  function getPerformanceBadge(percentage: number): { color: string; label: string } {
    if (percentage >= 90) return { color: 'variant-filled-success', label: 'Excellent' };
    if (percentage >= 80) return { color: 'variant-filled-primary', label: 'Very Good' };
    if (percentage >= 70) return { color: 'variant-filled-warning', label: 'Good' };
    if (percentage >= 60) return { color: 'variant-filled-surface', label: 'Fair' };
    return { color: 'variant-filled-error', label: 'Poor' };
  }

  // Load user statistics
  async function loadUserStats() {
    try {
      isLoading = true;
      error = null;
      userStats = await feedbackManager.getReviewStats(userHash);
    } catch (err) {
      console.error('Failed to load user stats:', err);
      error = 'Failed to load reputation data';
      userStats = null;
    } finally {
      isLoading = false;
    }
  }

  // Initialize on mount
  onMount(() => {
    loadUserStats();
  });

  function toggleDetails() {
    showDetailedStats = !showDetailedStats;
  }
</script>

<!-- User Reputation Display -->
<div class="user-reputation {compact ? 'compact' : 'full'}">
  {#if isLoading}
    <!-- Loading State -->
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined animate-pulse text-sm text-surface-400">star</span>
      <span class="text-surface-400 text-sm">Loading reputation...</span>
    </div>
  {:else if error}
    <!-- Error State -->
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined text-error-500 text-sm">error</span>
      <span class="text-error-500 text-sm">{error}</span>
    </div>
  {:else if !hasStats}
    <!-- No Reviews State -->
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined text-surface-400 text-sm">star_border</span>
      <span class="text-surface-500 text-sm">No reviews yet</span>
    </div>
  {:else}
    <!-- Reputation Display -->
    {#if compact}
      <!-- Compact View -->
      <div class="flex items-center gap-2">
        <!-- Star Rating -->
        <div class="flex items-center gap-1">
          {#each getStarDisplay(averageRating) as star, index}
            <span class="text-warning-500 text-sm">
              {#if star.type === 'full'}
                <span class="material-symbols-outlined">star</span>
              {:else if star.type === 'half'}
                <span class="material-symbols-outlined">star_half</span>
              {:else}
                <span class="material-symbols-outlined">star_border</span>
              {/if}
            </span>
          {/each}
        </div>

        <!-- Rating Value and Count -->
        <div class="flex items-center gap-1">
          <span class="font-medium {getRatingColor(averageRating)}">
            {averageRating.toFixed(1)}
          </span>
          <span class="text-surface-500 text-sm">
            ({totalReviews} review{totalReviews !== 1 ? 's' : ''})
          </span>
        </div>

        <!-- Details Toggle -->
        {#if showDetails}
          <button
            class="variant-ghost-surface btn-icon-sm btn"
            onclick={toggleDetails}
            title={showDetailedStats ? 'Hide details' : 'Show details'}
          >
            <span class="material-symbols-outlined text-sm">
              {showDetailedStats ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        {/if}
      </div>
    {:else}
      <!-- Full View -->
      <div class="space-y-3">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <h4 class="font-semibold">Reputation</h4>
          {#if showDetails}
            <button
              class="variant-ghost-surface btn-sm btn"
              onclick={toggleDetails}
            >
              <span class="material-symbols-outlined text-sm">
                {showDetailedStats ? 'expand_less' : 'expand_more'}
              </span>
              <span>{showDetailedStats ? 'Less' : 'More'}</span>
            </button>
          {/if}
        </div>

        <!-- Main Rating Display -->
        <div class="flex items-center gap-4">
          <!-- Large Rating Number -->
          <div class="text-center">
            <div class="text-3xl font-bold {getRatingColor(averageRating)}">
              {averageRating.toFixed(1)}
            </div>
            <div class="text-surface-500 text-xs">out of 5</div>
          </div>

          <!-- Stars and Description -->
          <div class="flex-grow">
            <div class="mb-1 flex items-center gap-1">
              {#each getStarDisplay(averageRating) as star}
                <span class="text-warning-500">
                  {#if star.type === 'full'}
                    <span class="material-symbols-outlined">star</span>
                  {:else if star.type === 'half'}
                    <span class="material-symbols-outlined">star_half</span>
                  {:else}
                    <span class="material-symbols-outlined">star_border</span>
                  {/if}
                </span>
              {/each}
            </div>
            <div class="text-surface-600 dark:text-surface-300 text-sm">
              {getRatingDescription(averageRating)} • {totalReviews} review{totalReviews !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <!-- Performance Metrics -->
        <div class="grid grid-cols-2 gap-3">
          <!-- On-Time Performance -->
          <div class="variant-soft-surface rounded-container-token p-3">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-surface-600 dark:text-surface-300 text-sm">On Time</span>
              <span class="badge {getPerformanceBadge(onTimePercentage).color} text-xs">
                {getPerformanceBadge(onTimePercentage).label}
              </span>
            </div>
            <div class="font-semibold">{Math.round(onTimePercentage)}%</div>
          </div>

          <!-- As Agreed Performance -->
          <div class="variant-soft-surface rounded-container-token p-3">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-surface-600 dark:text-surface-300 text-sm">As Agreed</span>
              <span class="badge {getPerformanceBadge(asAgreedPercentage).color} text-xs">
                {getPerformanceBadge(asAgreedPercentage).label}
              </span>
            </div>
            <div class="font-semibold">{Math.round(asAgreedPercentage)}%</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Detailed Statistics (Expandable) -->
    {#if showDetailedStats && userStats}
      <div class="variant-soft-surface rounded-container-token mt-4 p-4">
        <h5 class="mb-3 font-medium">Rating Distribution</h5>
        
        <!-- Rating Bars -->
        <div class="space-y-2">
          {#each [5, 4, 3, 2, 1, 0] as rating}
            {@const count = userStats.ratingDistribution[rating] || 0}
            {@const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0}
            
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <span class="text-sm">{rating}</span>
                <span class="material-symbols-outlined text-warning-500 text-sm">star</span>
              </div>
              
              <div class="bg-surface-200 dark:bg-surface-700 relative h-2 flex-grow rounded-full">
                <div 
                  class="bg-primary-500 h-full rounded-full transition-all duration-300"
                  style="width: {percentage}%"
                ></div>
              </div>
              
              <span class="text-surface-600 dark:text-surface-300 min-w-[3rem] text-right text-sm">
                {count} ({Math.round(percentage)}%)
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .user-reputation.compact {
    min-height: auto;
  }
  
  .user-reputation.full {
    min-width: 280px;
  }
</style>