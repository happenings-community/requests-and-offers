<script lang="ts">
  import {
    Avatar,
    getToastStore,
    getModalStore,
    type ModalComponent,
    type ModalSettings
  } from '@skeletonlabs/skeleton';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIRequest, UIOrganization, ConfirmModalMeta } from '$lib/types/ui';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import MediumOfExchangeTag from '$lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import { TimePreferenceHelpers } from '$lib/types/holochain';
  import { Effect as E } from 'effect';
  import { runEffect } from '$lib/utils/effect';
  import { queueAndReverseModal } from '$lib/utils';

  type Props = {
    request: UIRequest;
    mode?: 'compact' | 'expanded';
    showActions?: boolean;
    isArchived?: boolean;
    onUpdate?: () => void;
    showBulkSelection?: boolean;
    isSelected?: boolean;
    onSelectionChange?: (selected: boolean, requestId: string) => void;
  };

  const {
    request,
    mode = 'compact',
    showActions = false,
    isArchived = false,
    onUpdate,
    showBulkSelection = false,
    isSelected = false,
    onSelectionChange
  }: Props = $props();

  const toastStore = getToastStore();
  const modalStore = getModalStore();
  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };
  let isProcessing = $state(false);

  const creatorPictureUrl = $derived(
    request.creator
      ? '/default_avatar.webp' // For now, use default until we can fetch the actual user
      : '/default_avatar.webp'
  );

  // Organization details
  let organization = $state<UIOrganization | null>(null);
  let loadingOrganization = $state(false);

  $effect(() => {
    if (request.organization) {
      loadOrganization();
    }
  });

  async function loadOrganization() {
    if (!request.organization) return;
    try {
      loadingOrganization = true;
      organization = await E.runPromise(
        organizationsStore.getOrganizationByActionHash(request.organization)
      );
    } catch (error) {
      console.error('Error loading organization:', error);
      organization = null;
    } finally {
      loadingOrganization = false;
    }
  }

  // Navigate to user profile
  function navigateToUserProfile() {
    if (request.creator) {
      goto(`/users/${encodeHashToBase64(request.creator)}`);
    }
  }

  // Handle selection change
  function handleSelectionChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const requestId = request.original_action_hash?.toString() || '';
    onSelectionChange?.(checkbox.checked, requestId);
  }

  // Archive request
  function handleArchive() {
    if (!request.original_action_hash) return;

    const modalSettings: ModalSettings = {
      type: 'component',
      component: confirmModalComponent,
      meta: {
        message: 'Are you sure you want to archive this request?',
        confirmLabel: 'Archive',
        cancelLabel: 'Cancel'
      } as ConfirmModalMeta,
      response: (confirmed: boolean) => {
        if (confirmed) {
          modalStore.close();
          performArchive();
        }
      }
    };

    queueAndReverseModal(modalSettings, modalStore);
  }

  async function performArchive() {
    if (!request.original_action_hash) return;

    isProcessing = true;
    try {
      await runEffect(requestsStore.archiveRequest(request.original_action_hash));
      toastStore.trigger({
        message: 'Request archived successfully',
        background: 'variant-filled-success'
      });
      onUpdate?.();
    } catch (error) {
      console.error('Failed to archive request:', error);
      toastStore.trigger({
        message: 'Failed to archive request',
        background: 'variant-filled-error'
      });
    } finally {
      isProcessing = false;
    }
  }

  // Delete request
  function handleDelete() {
    if (!request.original_action_hash) return;

    const modalSettings: ModalSettings = {
      type: 'component',
      component: confirmModalComponent,
      meta: {
        message: 'Are you sure you want to delete this request? This action cannot be undone.',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel'
      } as ConfirmModalMeta,
      response: (confirmed: boolean) => {
        if (confirmed) {
          modalStore.close();
          performDelete();
        }
      }
    };

    queueAndReverseModal(modalSettings, modalStore);
  }

  async function performDelete() {
    if (!request.original_action_hash) return;

    isProcessing = true;
    try {
      await runEffect(requestsStore.deleteRequest(request.original_action_hash));
      toastStore.trigger({
        message: 'Request deleted successfully',
        background: 'variant-filled-success'
      });
      onUpdate?.();
    } catch (error) {
      console.error('Failed to delete request:', error);
      toastStore.trigger({
        message: 'Failed to delete request',
        background: 'variant-filled-error'
      });
    } finally {
      isProcessing = false;
    }
  }

  // Restore request (unarchive)
  async function handleRestore() {
    if (!request.original_action_hash) return;

    isProcessing = true;
    try {
      // For now, we'll need to implement a restore function in the store
      // This is a placeholder that shows the intended functionality
      toastStore.trigger({
        message: 'Restore functionality coming soon',
        background: 'variant-filled-warning'
      });
      onUpdate?.();
    } catch (error) {
      console.error('Failed to restore request:', error);
      toastStore.trigger({
        message: 'Failed to restore request',
        background: 'variant-filled-error'
      });
    } finally {
      isProcessing = false;
    }
  }
</script>

<div
  class="card variant-soft relative flex flex-col gap-3 p-4
  {mode === 'compact' ? 'text-sm' : 'text-base'}
  {isArchived ? 'opacity-60' : ''}"
>
  {#if showBulkSelection}
    <div class="absolute left-3 top-3">
      <input
        type="checkbox"
        class="checkbox"
        checked={isSelected}
        onchange={handleSelectionChange}
      />
    </div>
  {/if}

  {#if isArchived}
    <div class="absolute right-2 top-2">
      <span class="variant-filled-warning badge">Archived</span>
    </div>
  {/if}

  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3 {showBulkSelection ? 'ml-8' : ''}">
      <button class="flex" onclick={navigateToUserProfile}>
        <Avatar src={creatorPictureUrl} width="w-10" rounded="rounded-full" />
      </button>
      <div>
        <a
          href="/requests/{request.original_action_hash
            ? encodeHashToBase64(request.original_action_hash)
            : ''}"
          class="hover:underline"
        >
          <h3 class="font-semibold">{request.title}</h3>
        </a>
        {#if request.organization}
          <p class="text-xs text-primary-500 dark:text-primary-400">
            {#if loadingOrganization}
              <span class="font-medium">Loading organization...</span>
            {:else if organization}
              <span class="font-medium">{organization.name}</span>
            {:else}
              <span class="font-medium">Unknown organization</span>
            {/if}
          </p>
        {/if}
        {#if request.date_range?.start || request.date_range?.end}
          <p class="text-xs text-secondary-700 dark:text-secondary-400">
            <span class="font-medium">
              {#if request.date_range.start && request.date_range.end}
                Timeframe: {new Date(request.date_range.start).toLocaleDateString()} - {new Date(
                  request.date_range.end
                ).toLocaleDateString()}
              {:else if request.date_range.start}
                Starting: {new Date(request.date_range.start).toLocaleDateString()}
              {:else if request.date_range.end}
                Until: {new Date(request.date_range.end).toLocaleDateString()}
              {/if}
            </span>
          </p>
        {:else if request.time_preference}
          <p class="text-xs text-secondary-700 dark:text-secondary-400">
            <span class="font-medium">
              Time: {TimePreferenceHelpers.getDisplayValue(request.time_preference)}
            </span>
          </p>
        {/if}
        <!-- Interaction Type -->
        {#if request.interaction_type}
          <span class="variant-soft-tertiary badge">
            {request.interaction_type === 'Virtual' ? 'Virtual' : 'In Person'}
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Service Types and Medium of Exchange -->
  <div class="flex flex-col gap-2">
    {#if request.service_type_hashes && request.service_type_hashes.length > 0}
      <div>
        <p class="text-surface-600-300-token mb-1 text-xs font-medium">Service Types:</p>
        <div class="flex flex-wrap gap-1">
          {#each request.service_type_hashes.slice(0, 3) as serviceTypeHash}
            <span class="variant-soft-primary badge text-xs">Service Type</span>
          {/each}
          {#if request.service_type_hashes.length > 3}
            <span class="variant-soft-surface badge text-xs"
              >+{request.service_type_hashes.length - 3} more</span
            >
          {/if}
        </div>
      </div>
    {/if}

    {#if request.medium_of_exchange_hashes && request.medium_of_exchange_hashes.length > 0}
      <div>
        <p class="text-surface-600-300-token mb-1 text-xs font-medium">Mediums of Exchange:</p>
        <div class="flex flex-wrap gap-1">
          {#each request.medium_of_exchange_hashes.slice(0, 2) as mediumHash}
            <MediumOfExchangeTag mediumOfExchangeActionHash={mediumHash} />
          {/each}
          {#if request.medium_of_exchange_hashes.length > 2}
            <span class="variant-soft-surface badge text-xs"
              >+{request.medium_of_exchange_hashes.length - 2} more</span
            >
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if showActions}
    <div class="mt-2 flex flex-wrap gap-2">
      <button
        class="variant-filled-primary btn btn-sm"
        onclick={() => {
          if (request.original_action_hash) {
            goto(`/requests/${encodeHashToBase64(request.original_action_hash)}`);
          }
        }}
      >
        <span>📄</span> Details
      </button>

      {#if !isArchived}
        <button
          class="variant-ghost-warning btn btn-sm"
          onclick={handleArchive}
          disabled={isProcessing}
        >
          <span>📦</span> Archive
        </button>
      {:else}
        <button
          class="variant-ghost-success btn btn-sm"
          onclick={handleRestore}
          disabled={isProcessing}
        >
          <span>♻️</span> Restore
        </button>
      {/if}

      <button class="variant-ghost-error btn btn-sm" onclick={handleDelete} disabled={isProcessing}>
        <span>🗑️</span> Delete
      </button>
    </div>
  {/if}
</div>
