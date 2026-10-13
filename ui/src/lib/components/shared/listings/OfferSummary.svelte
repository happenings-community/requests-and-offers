<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIOffer } from '$lib/types/ui';
  import { formatDate } from '$lib/utils';
  import { stripMarkdown } from '$lib/utils/markdown';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';

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
    {#if offer.service_type_hash}
      <div class="mt-3 flex flex-wrap gap-1">
        <ServiceTypeTag serviceTypeActionHash={offer.service_type_hash} showLink={false} />
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
