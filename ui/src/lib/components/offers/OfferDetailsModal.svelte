<script lang="ts">
  import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
  import type { UIOffer, UIUser, UIOrganization, ConfirmModalMeta } from '$lib/types/ui';
  import { encodeHashToBase64 } from '@holochain/client';
  import { goto } from '$app/navigation';
  import {
    formatDate,
    getUserPictureUrl,
    getOrganizationLogoUrl,
    queueAndReverseModal
  } from '$lib/utils';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import MediumOfExchangeTag from '$lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte';
  import { TimePreferenceHelpers } from '$lib/types/holochain';
  import { Effect as E } from 'effect';
  import { runEffect } from '$lib/utils/effect';

  type OfferDetailsModalMeta = {
    offer: UIOffer;
  };

  // Get modal store and meta data
  const modalStore = getModalStore();
  const toastStore = getToastStore();

  // Register the ConfirmModal component
  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  const meta = $derived.by(() => {
    return $modalStore[0]?.meta as OfferDetailsModalMeta;
  });

  // Extract offer from meta
  const offer = $derived(meta?.offer);

  // Check if user can edit/delete the offer
  const { currentUser } = $derived(usersStore);
  const { agentIsAdministrator } = $derived(administrationStore);

  const canEdit = $derived.by(() => {
    if (!offer || !currentUser?.original_action_hash) return false;

    // User can edit if they created the offer
    if (offer.creator) {
      return offer.creator.toString() === currentUser.original_action_hash.toString();
    }

    // Admin can edit any offer
    if (agentIsAdministrator) {
      return true;
    }

    // User can edit if they are an organization coordinator
    if (offer.organization && organization?.coordinators) {
      return organization.coordinators.some(
        (coord) => coord.toString() === currentUser.original_action_hash?.toString()
      );
    }

    return false;
  });

  const canDelete = $derived.by(() => {
    if (!offer || !currentUser?.original_action_hash) return false;

    // User can delete if they created the offer
    if (offer.creator) {
      return offer.creator.toString() === currentUser.original_action_hash.toString();
    }

    // Admin can delete any offer
    if (agentIsAdministrator) {
      return true;
    }

    // User can delete if they are an organization coordinator
    if (offer.organization && organization?.coordinators) {
      return organization.coordinators.some(
        (coord) => coord.toString() === currentUser.original_action_hash?.toString()
      );
    }

    return false;
  });

  // State for creator and organization
  let creator: UIUser | null = $state(null);
  let organization: UIOrganization | null = $state(null);

  // Create URLs for images
  const creatorPictureUrl = $derived.by(() => (creator ? getUserPictureUrl(creator) : null));
  const organizationLogoUrl = $derived.by(() =>
    organization ? getOrganizationLogoUrl(organization) : null
  );

  // Format dates
  const createdAt = $derived(() => {
    if (!offer?.created_at) return 'Unknown';
    try {
      return formatDate(new Date(Number(offer.created_at)));
    } catch (err) {
      console.error('Error formatting created date:', err);
      return 'Invalid date';
    }
  });

  const updatedAt = $derived(() => {
    if (!offer?.updated_at) return 'N/A';
    try {
      return formatDate(new Date(Number(offer.updated_at)));
    } catch (err) {
      console.error('Error formatting updated date:', err);
      return 'Invalid date';
    }
  });

  // Handle edit action
  function handleEdit() {
    if (offer?.original_action_hash) {
      const offerId = encodeHashToBase64(offer.original_action_hash);
      modalStore.close();
      goto(`/offers/${offerId}/edit`);
    }
  }

  // Handle delete action
  function handleDelete() {
    if (!offer?.original_action_hash) return;

    // Create modal settings
    const modalSettings: ModalSettings = {
      type: 'component',
      component: confirmModalComponent,
      meta: {
        message: 'Are you sure you want to delete this offer?',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel'
      } as ConfirmModalMeta,
      response: (confirmed: boolean) => {
        if (confirmed) {
          // First close the confirmation modal
          modalStore.close();
          // Then perform the delete operation
          deleteOffer();
        }
      }
    };

    // Open the modal and ensure it appears on top
    queueAndReverseModal(modalSettings, modalStore);
  }

  // Function to actually delete the offer
  async function deleteOffer() {
    if (!offer?.original_action_hash) return;

    try {
      // Implement delete functionality
      await runEffect(offersStore.deleteOffer(offer.original_action_hash));

      // Close all modals
      modalStore.clear();

      toastStore.trigger({
        message: 'Offer deleted successfully!',
        background: 'variant-filled-success'
      });

      // If we're in the admin panel, stay there, otherwise go to requests
      if (window.location.pathname.startsWith('/admin')) {
        // Refresh the page to update the list
      } else {
        goto('/offers');
      }
    } catch (err) {
      console.error('Failed to delete offer:', err);
      toastStore.trigger({
        message: `Failed to delete offer: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

  // Handle view details action
  function handleViewDetails() {
    if (offer?.original_action_hash) {
      const offerId = encodeHashToBase64(offer.original_action_hash);
      modalStore.close();
      goto(`/offers/${offerId}`);
    }
  }

  // Clean up blob URLs when component is destroyed
  $effect(() => {
    return () => {
      if (creatorPictureUrl && creatorPictureUrl !== '/default_avatar.webp') {
        URL.revokeObjectURL(creatorPictureUrl);
      }
      if (organizationLogoUrl && organizationLogoUrl !== '/default_avatar.webp') {
        URL.revokeObjectURL(organizationLogoUrl);
      }
    };
  });

  // Load creator and organization data when offer changes
  $effect(() => {
    async function loadData() {
      if (!offer) return;

      // Load creator data
      if (offer.creator) {
        try {
          creator = await E.runPromise(usersStore.getUserByActionHash(offer.creator));
        } catch (err) {
          console.error('Failed to load creator:', err);
          creator = null;
        }
      }

      // Load organization data
      if (offer.organization) {
        try {
          organization = await E.runPromise(
            organizationsStore.getOrganizationByActionHash(offer.organization)
          );
        } catch (err) {
          console.error('Failed to load organization:', err);
          organization = null;
        }
      }
    }

    loadData();
  });
</script>

<!-- Modal with offer details -->
<article class="hcron-modal flex max-h-[90vh] flex-col overflow-hidden">
  <div class="flex-grow overflow-y-auto pr-1">
    <header class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2 class="h3 font-semibold">{offer?.title || 'Offer Details'}</h2>
      </div>
      <button class="variant-ghost-surface btn-icon" onclick={() => modalStore.close()}>
        <span class="material-symbols-outlined">close</span>
      </button>
    </header>

    <section class="space-y-4">
      <!-- Description -->
      <div>
        <h3 class="h4 font-semibold">Description</h3>
        <p class="whitespace-pre-line">{offer?.description || 'No description provided.'}</p>
      </div>

      <!-- Service Type -->
      <div>
        <h3 class="h4 mb-2 font-semibold">Service Types</h3>
        {#if offer?.service_type_hashes && offer.service_type_hashes.length > 0}
          <ul class="flex flex-wrap gap-2">
            {#each offer.service_type_hashes as serviceTypeHash}
              <li>
                <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} />
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-surface-500">No service types specified.</p>
        {/if}
      </div>

      <!-- Medium of Exchange -->
      <div>
        <h3 class="h4 mb-2 font-semibold">Medium of Exchange</h3>
        {#if offer?.medium_of_exchange_hashes && offer.medium_of_exchange_hashes.length > 0}
          <ul class="flex flex-wrap gap-2">
            {#each offer.medium_of_exchange_hashes as mediumHash}
              <li>
                <MediumOfExchangeTag mediumOfExchangeActionHash={mediumHash} />
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-surface-500">No medium of exchange specified.</p>
        {/if}
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <!-- Contact Information -->
        <div>
          <h3 class="text-lg font-semibold">Contact Information</h3>
          <p><strong>Time Zone:</strong> {offer.time_zone || 'Not specified'}</p>
          <p>
            <strong>Time Preference:</strong>
            {TimePreferenceHelpers.getDisplayValue(offer.time_preference)}
          </p>
        </div>

        <!-- Interaction Type -->
        {#if offer?.interaction_type}
          <div>
            <h3 class="text-lg font-semibold">Interaction Type</h3>
            <p>{offer.interaction_type === 'Virtual' ? 'Virtual' : 'In Person'}</p>
          </div>
        {/if}

        <!-- Links -->
        {#if offer?.links && offer.links.length > 0}
          <div>
            <h3 class="text-lg font-semibold">Related Links</h3>
            <ul class="list-inside list-disc">
              {#each offer.links as link}
                <li>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-600 hover:underline"
                  >
                    {link}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </section>
  </div>

  <!-- Creator info -->
  {#if offer?.creator}
    <div>
      <h3 class="h4 font-semibold">Creator</h3>
      <div class="flex items-center gap-2">
        {#if creator}
          <div class="flex items-center gap-3">
            <div class="avatar h-12 w-12 overflow-hidden rounded-full">
              {#if creatorPictureUrl && creatorPictureUrl !== '/default_avatar.webp'}
                <img
                  src={creatorPictureUrl}
                  alt={creator.name}
                  class="h-full w-full object-cover"
                />
              {:else}
                <div
                  class="flex h-full w-full items-center justify-center bg-primary-500 text-white dark:bg-primary-400"
                >
                  <span class="text-lg font-semibold">{creator.name.charAt(0).toUpperCase()}</span>
                </div>
              {/if}
            </div>
            <div>
              <p class="font-semibold">{creator.name}</p>
              {#if creator.nickname}
                <p class="text-surface-600-300-token text-sm">@{creator.nickname}</p>
              {/if}
            </div>
          </div>
        {:else}
          <a
            href={`/users/${encodeHashToBase64(offer.creator)}`}
            class="text-primary-500 hover:underline dark:text-primary-400"
          >
            View Creator Profile
          </a>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Organization info (if applicable) -->
  {#if offer?.organization}
    <div>
      <h3 class="h4 font-semibold">Organization</h3>
      <div class="flex items-center gap-2">
        {#if organization}
          <div class="flex items-center gap-3">
            <div class="avatar h-12 w-12 overflow-hidden rounded-full">
              {#if organizationLogoUrl && organizationLogoUrl !== '/default_avatar.webp'}
                <img
                  src={organizationLogoUrl}
                  alt={organization.name}
                  class="h-full w-full object-cover"
                />
              {:else}
                <div
                  class="flex h-full w-full items-center justify-center bg-secondary-500 text-white"
                >
                  <span class="text-lg font-semibold"
                    >{organization.name.charAt(0).toUpperCase()}</span
                  >
                </div>
              {/if}
            </div>
            <div>
              <p class="font-semibold">{organization.name}</p>
              {#if organization.description}
                <p class="text-surface-600-300-token text-sm">
                  {organization.description.substring(0, 50)}...
                </p>
              {/if}
            </div>
          </div>
        {:else}
          <a
            href={`/organizations/${encodeHashToBase64(offer.organization)}`}
            class="text-primary-500 hover:underline dark:text-primary-400"
          >
            View Organization
          </a>
        {/if}
      </div>

      <!-- Organization Coordinators -->
      {#if organization?.coordinators && organization.coordinators.length > 0}
        <div class="mt-2">
          <p class="text-sm font-medium">Exchange Coordinators:</p>
          <div class="mt-1 flex flex-wrap gap-2">
            {#each organization.coordinators as coordinator}
              <a
                href={`/users/${encodeHashToBase64(coordinator)}`}
                class="variant-soft-secondary chip hover:variant-soft-primary"
              >
                View Coordinator
              </a>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Metadata -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <div>
      <h3 class="h4 font-semibold">Created</h3>
      <p>{createdAt()}</p>
    </div>
    <div>
      <h3 class="h4 font-semibold">Last Updated</h3>
      <p>{updatedAt()}</p>
    </div>
  </div>

  <!-- Admin status -->
  {#if agentIsAdministrator}
    <div class="bg-primary-100 p-2 rounded-container-token dark:bg-primary-900">
      <p class="text-center text-sm">You are viewing this as an administrator</p>
    </div>
  {/if}

  <!-- Action buttons -->
  <footer class="mt-6 flex justify-end gap-2">
    <button class="variant-filled-primary btn" onclick={handleViewDetails}>
      View Full Details
    </button>

    {#if canEdit || agentIsAdministrator}
      <button class="variant-filled-secondary btn" onclick={handleEdit}> Edit </button>
    {/if}

    {#if canDelete || agentIsAdministrator}
      <button class="variant-filled-error btn" onclick={handleDelete}> Delete </button>
    {/if}
  </footer>
</article>
