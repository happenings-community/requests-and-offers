<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import type { ConfirmModalMeta } from '$lib/types/ui';
  import { queueAndReverseModal } from '$lib/utils';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';

  type Props = {
    onArchive: (() => void) | null;
    onDelete: (() => void) | null;
    isArchived: boolean;
    listingType: 'request' | 'offer';
  };

  // Props
  let {
    onArchive = null,
    onDelete = null,
    isArchived = false,
    listingType = 'request'
  }: Props = $props();

  // Stores
  const modalStore = getModalStore();

  // Register the ConfirmModal component
  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  // Actions
  function handleArchive() {
    if (!onArchive) return;

    if (isArchived) {
      // Already archived, no confirmation needed for unarchive
      onArchive();
    } else {
      // Confirm archive
      const modalSettings: ModalSettings = {
        type: 'component',
        component: confirmModalComponent,
        meta: {
          message: `Are you sure you want to archive this ${listingType}? It will no longer be visible to other users.`,
          confirmLabel: 'Archive',
          cancelLabel: 'Cancel'
        } as ConfirmModalMeta,
        response: (confirmed: boolean) => {
          if (confirmed) {
            onArchive();
          }
        }
      };

      queueAndReverseModal(modalSettings, modalStore);
    }
  }

  function handleDelete() {
    if (!onDelete) return;

    const modalSettings: ModalSettings = {
      type: 'component',
      component: confirmModalComponent,
      meta: {
        message: `Are you sure you want to permanently delete this ${listingType}? This action cannot be undone.`,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel'
      } as ConfirmModalMeta,
      response: (confirmed: boolean) => {
        if (confirmed) {
          onDelete();
        }
      }
    };

    queueAndReverseModal(modalSettings, modalStore);
  }
</script>

<div class="flex flex-wrap gap-2">
  {#if onArchive}
    <button
      class={isArchived ? 'variant-filled-primary btn' : 'variant-filled-warning btn'}
      onclick={handleArchive}
      aria-label={isArchived ? `Unarchive ${listingType}` : `Archive ${listingType}`}
    >
      {isArchived ? '🔄 Unarchive' : '📦 Archive'}
    </button>
  {/if}

  {#if onDelete}
    <button
      class="variant-filled-error btn"
      onclick={handleDelete}
      aria-label={`Delete ${listingType}`}
    >
      🗑️ Delete
    </button>
  {/if}
</div>
