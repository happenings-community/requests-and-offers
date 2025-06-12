<script lang="ts">
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import type { UIServiceType } from '$lib/types/ui';
  import { page } from '$app/state';

  type Props = {
    serviceType: UIServiceType;
    onEdit?: () => void;
    onDelete?: () => void;
    showActions?: boolean;
  };

  const { serviceType, onEdit, onDelete, showActions = false }: Props = $props();

  // Derived: route depending on admin status
  const inAdminPath = $derived(page.url.pathname.startsWith('/admin/'));
  // Reactive helpers
  const encodedHash = $derived(
    serviceType.original_action_hash ? encodeHashToBase64(serviceType.original_action_hash) : ''
  );

  const detailsPath = $derived(
    inAdminPath
      ? `/admin/service-types/${encodedHash}`
      : `/service-types/${encodedHash}`
  );

  // Format date for display
  function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
</script>

<div class="card">
  <header class="card-header">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h3 class="h3"><a href={detailsPath}>{serviceType.name}</a></h3>
        <p class="text-surface-600 dark:text-surface-400 text-sm">
          {#if serviceType.created_at}
            Created {formatDate(new Date(serviceType.created_at))}
            {#if serviceType.updated_at && serviceType.updated_at !== serviceType.created_at}
              • Updated {formatDate(new Date(serviceType.updated_at))}
            {/if}
          {/if}
        </p>
      </div>
      {#if showActions}
        <div class="flex space-x-2">
          {#if onEdit}
            <button
              aria-label="Edit service type"
              class="btn btn-sm variant-ghost-primary"
              onclick={onEdit}
              title="Edit service type"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          {/if}
          {#if onDelete}
            <button
              aria-label="Delete service type"
              class="btn btn-sm variant-ghost-error"
              onclick={onDelete}
              title="Delete service type"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </header>

  <section class="p-4">
    <!-- Description -->
    <p class="text-surface-700 dark:text-surface-300 mb-4">{serviceType.description}</p>

    <!-- Tags -->
    {#if serviceType.tags.length > 0}
      <div class="space-y-2">
        <h4 class="text-surface-600 dark:text-surface-400 text-sm font-semibold">Tags</h4>
        <div class="flex flex-wrap gap-2">
          {#each serviceType.tags as tag}
            <span class="badge variant-soft-primary">{tag}</span>
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <!-- Footer with metadata -->
  <footer class="card-footer">
    <div class="text-surface-600 dark:text-surface-400 flex items-center justify-between text-xs">
      {#if serviceType.original_action_hash}
        <span>ID: {serviceType.original_action_hash.toString().slice(0, 8)}...</span>
      {:else}
        <span>No ID</span>
      {/if}
      <span>{serviceType.tags.length} tag{serviceType.tags.length !== 1 ? 's' : ''}</span>
    </div>
  </footer>
</div>
