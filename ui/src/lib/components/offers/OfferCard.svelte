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
  import type { UIOffer, UIOrganization, ConfirmModalMeta } from '$lib/types/ui';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import MediumOfExchangeTag from '$lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import { TimePreferenceHelpers } from '$lib/types/holochain';
  import { Effect as E } from 'effect';
  import { runEffect } from '$lib/utils/effect';
  import { queueAndReverseModal } from '$lib/utils';

  type Props = {
    offer: UIOffer;
    mode?: 'compact' | 'expanded';
    showActions?: boolean;
    isArchived?: boolean;
    onUpdate?: () => void;
    showBulkSelection?: boolean;
    isSelected?: boolean;
    onSelectionChange?: (selected: boolean, offerId: string) => void;
  };

  const {
    offer,
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
    offer.creator
      ? '/default_avatar.webp' // For now, use default until we can fetch the actual user
      : '/default_avatar.webp'
  );

  // Organization details
  let organization = $state<UIOrganization | null>(null);
  let loadingOrganization = $state(false);

  $effect(() => {
    if (offer.organization) {
      loadOrganization();
    }
  });

  async function loadOrganization() {
    if (!offer.organization) return;
    try {
      loadingOrganization = true;
      organization = await E.runPromise(
        organizationsStore.getOrganizationByActionHash(offer.organization)
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
    if (offer.creator) {
      goto(`/users/${encodeHashToBase64(offer.creator)}`);
    }
  }

  // Handle selection change
  function handleSelectionChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const offerId = offer.original_action_hash?.toString() || '';
    onSelectionChange?.(checkbox.checked, offerId);
  }

  // Archive offer
  function handleArchive() {
    if (!offer.original_action_hash) return;

    const modalSettings: ModalSettings = {
      type: 'component',
      component: confirmModalComponent,
      meta: {
        message: 'Are you sure you want to archive this offer?',
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
    if (!offer.original_action_hash) return;

    isProcessing = true;
    try {
      await runEffect(offersStore.archiveOffer(offer.original_action_hash));
      toastStore.trigger({
        message: 'Offer archived successfully',
        background: 'variant-filled-success'
      });
      onUpdate?.();
    } catch (error) {
      console.error('Failed to archive offer:', error);
      toastStore.trigger({
        message: 'Failed to archive offer',
        background: 'variant-filled-error'
      });
    } finally {
      isProcessing = false;
    }
  }

  // Delete offer
  function handleDelete() {
    if (!offer.original_action_hash) return;

    const modalSettings: ModalSettings = {
      type: 'component',
      component: confirmModalComponent,
      meta: {
        message: 'Are you sure you want to delete this offer? This action cannot be undone.',
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
    if (!offer.original_action_hash) return;

    isProcessing = true;
    try {
      await runEffect(offersStore.deleteOffer(offer.original_action_hash));
      toastStore.trigger({
        message: 'Offer deleted successfully',
        background: 'variant-filled-success'
      });
      onUpdate?.();
    } catch (error) {
      console.error('Failed to delete offer:', error);
      toastStore.trigger({
        message: 'Failed to delete offer',
        background: 'variant-filled-error'
      });
    } finally {
      isProcessing = false;
    }
  }

  // Restore offer (unarchive)
  async function handleRestore() {
    if (!offer.original_action_hash) return;

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
      console.error('Failed to restore offer:', error);
      toastStore.trigger({
        message: 'Failed to restore offer',
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
          href="/offers/{offer.original_action_hash
            ? encodeHashToBase64(offer.original_action_hash)
            : ''}"
          class="hover:underline"
        >
          <h3 class="font-semibold">{offer.title}</h3>
        </a>
        {#if offer.organization}
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
        {#if offer.time_preference}
          <p class="text-xs text-secondary-500">
            <span class="font-medium">
              Time: {TimePreferenceHelpers.getDisplayValue(offer.time_preference)}
            </span>
          </p>
        {/if}
        <!-- Interaction Type -->
        {#if offer.interaction_type}
          <span class="variant-soft-tertiary badge">
            {offer.interaction_type === 'Virtual' ? 'Virtual' : 'In Person'}
          </span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Service Types and Medium of Exchange -->
  <div class="flex flex-col gap-2">
    {#if offer.service_type_hashes && offer.service_type_hashes.length > 0}
      <div>
        <p class="text-surface-600-300-token mb-1 text-xs font-medium">Service Types:</p>
        <div class="flex flex-wrap gap-1">
          <span class="variant-soft-primary badge text-xs">
            {offer.service_type_hashes.length} service type{offer.service_type_hashes.length !== 1
              ? 's'
              : ''}
          </span>
        </div>
      </div>
    {/if}

    {#if offer.medium_of_exchange_hashes && offer.medium_of_exchange_hashes.length > 0}
      <div>
        <p class="text-surface-600-300-token mb-1 text-xs font-medium">Mediums of Exchange:</p>
        <div class="flex flex-wrap gap-1">
          {#each offer.medium_of_exchange_hashes.slice(0, 2) as mediumHash}
            <MediumOfExchangeTag mediumOfExchangeActionHash={mediumHash} />
          {/each}
          {#if offer.medium_of_exchange_hashes.length > 2}
            <span class="variant-soft-surface badge text-xs"
              >+{offer.medium_of_exchange_hashes.length - 2} more</span
            >
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if mode === 'expanded'}
    <div>
      <p class="text-surface-600-300-token opacity-80">
        {offer.description}
      </p>
    </div>
  {/if}

  {#if showActions}
    <div class="mt-2 flex flex-wrap gap-2">
      <button
        class="variant-filled-primary btn btn-sm"
        onclick={() => {
          if (offer.original_action_hash) {
            goto(`/offers/${encodeHashToBase64(offer.original_action_hash)}`);
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
