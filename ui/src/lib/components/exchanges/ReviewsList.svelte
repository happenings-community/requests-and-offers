<!-- ReviewsList.svelte - List of exchange reviews -->
<script lang="ts">
  import type { UIExchangeReview } from '$lib/services/zomes/exchanges.service';

  interface Props {
    reviews: UIExchangeReview[];
  }

  const { reviews }: Props = $props();

  const formatRating = (rating: number) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };
</script>

<div class="space-y-2">
  {#if reviews.length === 0}
    <div class="text-center py-8 text-surface-600 dark:text-surface-400">
      No reviews found.
    </div>
  {:else}
    {#each reviews as review}
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-lg">{formatRating(review.entry.rating)}</span>
              <span class="text-sm text-surface-600 dark:text-surface-400">
                by {review.entry.reviewer_type}
              </span>
            </div>

            {#if review.entry.comments}
              <p class="text-sm text-surface-700 dark:text-surface-300 mt-2">
                "{review.entry.comments}"
              </p>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  {/if}
</div>