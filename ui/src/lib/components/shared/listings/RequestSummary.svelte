<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIRequest } from '$lib/types/ui';
  import { formatDate } from '$lib/utils';
  import { stripMarkdown } from '$lib/utils/markdown';

  // Props
  let { request, showActions = false }: { request: UIRequest; showActions: boolean } = $props();

  // Computed values
  const createdAt = $derived(
    request.created_at ? formatDate(new Date(Number(request.created_at))) : 'Unknown'
  );
  const updatedAt = $derived(
    request.updated_at ? formatDate(new Date(Number(request.updated_at))) : 'N/A'
  );
</script>

<article class="card overflow-hidden transition-shadow hover:shadow-lg">
  <div class="p-4">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <div class="mb-1 flex items-center gap-2">
          <h3 class="truncate font-semibold">{request.title}</h3>
        </div>
        <p class="line-clamp-2 text-sm text-surface-600 dark:text-surface-400">
          {stripMarkdown(request.description)}
        </p>
      </div>
    </div>

    <!-- Service Types -->
    {#if request.service_type_hashes && request.service_type_hashes.length > 0}
      <div class="mt-3 flex flex-wrap gap-1">
        {#each request.service_type_hashes.slice(0, 3)}
          <span class="variant-soft-primary chip text-xs">Service</span>
        {/each}
        {#if request.service_type_hashes.length > 3}
          <span class="variant-soft-surface chip text-xs">
            +{request.service_type_hashes.length - 3} more
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
          href="/requests/{encodeHashToBase64(request.original_action_hash!)}"
          class="variant-filled-primary btn btn-sm flex-1"
        >
          View Details
        </a>
      </div>
    {/if}
  </div>
</article>
