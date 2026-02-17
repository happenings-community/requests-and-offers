<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIOffer } from '$lib/types/ui';
  import { formatDate } from '$lib/utils';
  import { stripMarkdown } from '$lib/utils/markdown';

  type Props = {
    offer: UIOffer;
    showActions: boolean;
  };

  // Props
  let { offer, showActions = false }: Props = $props();

  // Computed values
  const createdAt = $derived(
    offer.created_at ? formatDate(new Date(Number(offer.created_at))) : 'Unknown'
  );
  const updatedAt = $derived(
    offer.updated_at ? formatDate(new Date(Number(offer.updated_at))) : 'N/A'
  );
</script>

<article class="card overflow-hidden transition-shadow hover:shadow-lg">
  <div class="p-4">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <div class="mb-1 flex items-center gap-2">
          <h3 class="truncate font-semibold">{offer.title}</h3>
        </div>
        <p class="line-clamp-2 text-sm text-surface-600 dark:text-surface-400">
          {stripMarkdown(offer.description)}
        </p>
      </div>
    </div>

    <!-- Service Types -->
    {#if offer.service_type_hashes && offer.service_type_hashes.length > 0}
      <div class="mt-3 flex flex-wrap gap-1">
        {#each offer.service_type_hashes.slice(0, 3)}
          <span class="variant-soft-secondary chip text-xs">Service</span>
        {/each}
        {#if offer.service_type_hashes.length > 3}
          <span class="variant-soft-surface chip text-xs">
            +{offer.service_type_hashes.length - 3} more
          </span>
        {/if}
      </div>
    {/if}

    <!-- Metadata -->
    <div class="mt-3 flex items-center justify-between text-xs text-surface-500">
      <span>Created: {createdAt}</span>
      {#if updatedAt !== 'N/A' && updatedAt !== createdAt}
        <span>Updated: {updatedAt}</span>
      {/if}
    </div>

    <!-- Actions -->
    {#if showActions}
      <div class="mt-3 flex gap-2">
        <a
          href="/offers/{encodeHashToBase64(offer.original_action_hash!)}"
          class="variant-filled-secondary btn btn-sm flex-1"
        >
          View Details
        </a>
      </div>
    {/if}
  </div>
</article>
