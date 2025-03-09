<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { UIRequest } from '@/types/ui';
  import { encodeHashToBase64 } from '@holochain/client';
  import { goto } from '$app/navigation';
  import RequestStatusBadge from '@/lib/components/RequestStatusBadge.svelte';
  import RequestSkillsTags from '@/lib/components/RequestSkillsTags.svelte';
  import { formatDate } from '@/utils';

  type RequestDetailsModalMeta = {
    request: UIRequest;
    canEdit: boolean;
    canDelete: boolean;
  };

  // Get modal store and meta data
  const modalStore = getModalStore();
  const meta = $derived.by(() => {
    return $modalStore[0]?.meta as RequestDetailsModalMeta;
  });

  // Extract request and permissions from meta
  const request = $derived(meta?.request);
  const canEdit = $derived.by(() => {
    if (!meta?.request || !meta?.request.creator) return false;
    // User can edit if they created the request
    if (
      meta.request.creator &&
      meta.request.creator.toString() === meta.request.original_action_hash?.toString()
    ) {
      return true;
    }
    // TODO: Add organization coordinator check
    return false;
  });
  const canDelete = $derived(meta?.canDelete ?? false);

  // Format dates
  const createdAt = $derived(() =>
    request?.created_at ? formatDate(new Date(request.created_at)) : 'Unknown'
  );
  const updatedAt = $derived(() =>
    request?.updated_at ? formatDate(new Date(request.updated_at)) : 'N/A'
  );

  // Handle edit action
  function handleEdit() {
    if (request?.original_action_hash) {
      const requestId = encodeHashToBase64(request.original_action_hash);
      modalStore.close();
      goto(`/requests/${requestId}/edit`);
    }
  }

  // Handle delete action
  function handleDelete() {
    // TODO: Implement delete confirmation and action
    console.log('Delete request', request);
    modalStore.close();
  }

  // Handle view details action
  function handleViewDetails() {
    if (request?.original_action_hash) {
      const requestId = encodeHashToBase64(request.original_action_hash);
      modalStore.close();
      goto(`/requests/${requestId}`);
    }
  }
</script>

<!-- Modal with request details -->
<div class="modal-container p-4">
  <header class="mb-4 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <h2 class="h3 font-semibold">{request?.title || 'Request Details'}</h2>
      {#if request?.process_state}
        <RequestStatusBadge state={request.process_state} showLabel={true} />
      {/if}
    </div>
    <button class="btn-icon variant-ghost-surface" onclick={() => modalStore.close()}>
      <span class="material-icons">close</span>
    </button>
  </header>

  <section class="space-y-4">
    <!-- Description -->
    <div>
      <h3 class="h4 font-semibold">Description</h3>
      <p class="whitespace-pre-line">{request?.description || 'No description provided.'}</p>
    </div>

    <!-- Skills -->
    <div>
      <h3 class="h4 font-semibold">Skills Required</h3>
      {#if request?.skills && request.skills.length > 0}
        <RequestSkillsTags skills={request.skills} maxVisible={10} />
      {:else}
        <p class="text-surface-500">No skills specified.</p>
      {/if}
    </div>

    <!-- Creator info -->
    <div>
      <h3 class="h4 font-semibold">Creator</h3>
      <div class="flex items-center gap-2">
        <!-- TODO: Add creator avatar and details when available -->
        <span class="text-surface-500 italic">Creator information will be displayed here</span>
      </div>
    </div>

    <!-- Organization info (if applicable) -->
    {#if request?.organization}
      <div>
        <h3 class="h4 font-semibold">Organization</h3>
        <div class="flex items-center gap-2">
          <!-- TODO: Add organization logo and details when available -->
          <span class="text-surface-500 italic"
            >Organization information will be displayed here</span
          >
        </div>
      </div>
    {/if}

    <!-- Metadata -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <h3 class="h4 font-semibold">Created</h3>
        <p>{createdAt}</p>
      </div>
      <div>
        <h3 class="h4 font-semibold">Last Updated</h3>
        <p>{updatedAt}</p>
      </div>
    </div>
  </section>

  <!-- Action buttons -->
  <footer class="mt-6 flex justify-end gap-2">
    <button class="btn variant-filled-primary" onclick={handleViewDetails}>
      View Full Details
    </button>

    {#if canEdit}
      <button class="btn variant-filled-secondary" onclick={handleEdit}> Edit </button>
    {/if}

    {#if canDelete}
      <button class="btn variant-filled-error" onclick={handleDelete}> Delete </button>
    {/if}
  </footer>
</div>
