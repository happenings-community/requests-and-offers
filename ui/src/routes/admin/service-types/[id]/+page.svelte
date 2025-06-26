<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { UIServiceType } from '$lib/types/ui';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import type { ConfirmModalMeta } from '$lib/types/ui';

  // Local state
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let serviceType: UIServiceType | null = $state(null);

  const serviceTypeId = $derived(page.params.id);

  $effect(() => {
    async function load() {
      try {
        isLoading = true;
        if (!serviceTypeId) {
          error = 'Invalid service type id';
          return;
        }
        const hash = decodeHashFromBase64(serviceTypeId);
        const result = await runEffect(serviceTypesStore.getServiceType(hash));
        if (!result) {
          error = 'Service type not found';
          return;
        }
        serviceType = result;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      } finally {
        isLoading = false;
      }
    }
    load();
  });

  // Navigation functions
  function navigateBack() {
    goto('/admin/service-types');
  }

  function navigateToEdit() {
    if (serviceType?.original_action_hash) {
      const encodedHash = encodeHashToBase64(serviceType.original_action_hash);
      goto(`/admin/service-types/${encodedHash}/edit`);
    }
  }

  async function refreshData() {
    if (serviceTypeId) {
      isLoading = true;
      error = null;
      try {
        const hash = decodeHashFromBase64(serviceTypeId);
        const result = await runEffect(serviceTypesStore.getServiceType(hash));
        if (!result) {
          error = 'Service type not found';
          return;
        }
        serviceType = result;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      } finally {
        isLoading = false;
      }
    }
  }

  async function deleteServiceType() {
    if (!serviceType?.original_action_hash) {
      error = 'Cannot delete service type: missing action hash';
      return;
    }

    try {
      await runEffect(serviceTypesStore.deleteServiceType(serviceType.original_action_hash));
      navigateBack();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  // Modal store for confirmations
  const modalStore = getModalStore();

  // Register the ConfirmModal component
  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  // Handle delete with confirmation
  async function handleDelete() {
    const confirmed = await new Promise<boolean>((resolve) => {
      modalStore.trigger({
        type: 'component',
        component: confirmModalComponent,
        meta: {
          message:
            'Are you sure you want to delete this service type?<br/>This action cannot be undone.',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel'
        } as ConfirmModalMeta,
        response: (result: boolean) => resolve(result)
      });
    });

    if (confirmed) {
      await deleteServiceType();
    }
  }
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="h1">Service Type Details</h1>
    <button class="variant-soft btn" onclick={navigateBack}> Back to Service Types </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={refreshData}>Try Again</button>
        <button class="btn btn-sm" onclick={navigateBack}>Back to Service Types</button>
      </div>
    </div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading service type...</p>
    </div>
  {:else if serviceType}
    <div class="card p-6">
      <header class="card-header flex items-start justify-between">
        <div>
          <h2 class="h2">{serviceType.name}</h2>
          <p class="text-surface-400 mt-2">{serviceType.description}</p>
        </div>

        <div class="flex gap-2">
          <button class="variant-soft-primary btn" onclick={navigateToEdit}>Edit</button>
          <button class="variant-soft-error btn" onclick={handleDelete}>Delete</button>
        </div>
      </header>

      <section class="space-y-6 p-4">
        <!-- Tags -->
        {#if serviceType.tags && serviceType.tags.length > 0}
          <div>
            <h3 class="h3 mb-2">Tags</h3>
            <div class="flex flex-wrap gap-2">
              {#each serviceType.tags as tag}
                <a
                  href={`/tags/${encodeURIComponent(tag)}`}
                  class="variant-soft-primary badge hover:variant-filled-primary cursor-pointer transition-colors"
                  title="View all content tagged with {tag}"
                >
                  {tag}
                </a>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Metadata -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="card variant-soft p-4">
            <h4 class="h4 mb-2">Created</h4>
            <p class="text-sm">
              {serviceType.created_at
                ? new Date(serviceType.created_at).toLocaleDateString()
                : 'Unknown'}
            </p>
            <p class="text-surface-500 mt-1 text-xs">
              by {serviceType.creator
                ? serviceType.creator.toString().slice(0, 8) + '...'
                : 'Unknown'}
            </p>
          </div>

          <div class="card variant-soft p-4">
            <h4 class="h4 mb-2">Last Updated</h4>
            <p class="text-sm">
              {serviceType.updated_at
                ? new Date(serviceType.updated_at).toLocaleDateString()
                : 'Unknown'}
            </p>
          </div>
        </div>

        <!-- Action Hashes (for debugging/admin purposes) -->
        <details class="card variant-soft p-4">
          <summary class="h4 cursor-pointer">Technical Details</summary>
          <div class="mt-4 space-y-2 text-xs">
            <div>
              <strong>Original Action Hash:</strong>
              <code class="code break-all text-xs">
                {serviceType.original_action_hash
                  ? encodeHashToBase64(serviceType.original_action_hash)
                  : 'N/A'}
              </code>
            </div>
            <div>
              <strong>Previous Action Hash:</strong>
              <code class="code break-all text-xs">
                {serviceType.previous_action_hash
                  ? encodeHashToBase64(serviceType.previous_action_hash)
                  : 'N/A'}
              </code>
            </div>
          </div>
        </details>
      </section>
    </div>
  {:else}
    <div class="text-surface-500 text-center text-xl">Service type not found.</div>
  {/if}
</section>
