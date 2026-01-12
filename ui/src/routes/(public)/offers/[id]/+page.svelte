<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import { formatDate, getUserPictureUrl, getOrganizationLogoUrl } from '$lib/utils';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import MediumOfExchangeTag from '$lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import { isUserApproved } from '$lib/utils';
  import type { UIOffer, UIUser, UIOrganization } from '$lib/types/ui';
  import { ListingStatus, TimePreferenceHelpers } from '$lib/types/holochain';
  import { runEffect } from '$lib/utils/effect';
  import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
  import { useAdminStatusGuard } from '$lib/composables/connection/useAdminStatusGuard.svelte';
  import ContactButton from '$lib/components/shared/listings/ContactButton.svelte';

  const toastStore = getToastStore();

  // Get offer ID from route params
  const offerId = $derived(page.params.id);
  const offerHash = $derived(() => {
    try {
      return offerId ? decodeHashFromBase64(offerId) : null;
    } catch {
      return null;
    }
  });

  // State
  let offer: UIOffer | null = $state(null);
  let creator: UIUser | null = $state(null);
  let organization: UIOrganization | null = $state(null);
  let isLoading = $state(true);
  let error: string | null = $state(null);

  // Get current user and admin status (with guard for reliable detection)
  const { currentUser } = $derived(usersStore);
  const adminStatusGuard = useAdminStatusGuard();
  const agentIsAdministrator = $derived(adminStatusGuard.agentIsAdministrator);

  // Permission checks
  const canEdit = $derived.by(() => {
    if (!offer || !currentUser?.original_action_hash) return false;

    // Cannot edit archived offers
    if (offer.status === ListingStatus.Archived) return false;

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

  // Image URLs
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

  // Actions
  function handleEdit() {
    if (offer?.original_action_hash) {
      const id = encodeHashToBase64(offer.original_action_hash);
      goto(`/offers/${id}/edit`);
    }
  }

  async function handleDelete() {
    if (!offer?.original_action_hash) return;

    if (!confirm('Are you sure you want to delete this offer?')) return;

    try {
      await runEffect(offersStore.deleteOffer(offer.original_action_hash));

      toastStore.trigger({
        message: 'Offer deleted successfully!',
        background: 'variant-filled-success'
      });

      goto('/offers');
    } catch (err) {
      console.error('Failed to delete offer:', err);
      toastStore.trigger({
        message: `Failed to delete offer: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

  function handleRefresh() {
    window.location.reload();
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

  // Load offer data
  $effect(() => {
    async function loadOfferData() {
      try {
        isLoading = true;
        error = null;

        if (!offerHash()) {
          error = 'Invalid offer ID';
          return;
        }

        // Show connecting message during connection and data load
        error = 'Connecting to network...';

        // Ensure connection using Effect patterns with retry and timeout
        await runEffect(useConnectionGuard());

        // Load offer data
        offer = await runEffect(offersStore.getOffer(offerHash()!));

        // Clear the connecting message on success
        error = null;

        if (!offer) {
          error = 'Offer not found';
          return;
        }

        // Load creator data
        if (offer.creator) {
          try {
            creator = await runEffect(usersStore.getUserByActionHash(offer.creator));
          } catch (err) {
            console.error('Failed to load creator:', err);
            creator = null;
          }
        }

        // Load organization data
        if (offer.organization) {
          try {
            organization = await runEffect(
              organizationsStore.getOrganizationByActionHash(offer.organization)
            );
          } catch (err) {
            console.error('Failed to load organization:', err);
            organization = null;
          }
        }
      } catch (err) {
        console.error('Failed to load offer data:', err);

        // Handle different types of errors with specific user-friendly messages
        if (err instanceof Error) {
          if (err.message.includes('Connection') || err.message.includes('Client not connected')) {
            error = 'Failed to connect to network. Please refresh the page.';
          } else if (err.message.includes('timeout') || err.message.includes('Timeout')) {
            error = 'Request timed out. Please check your connection and try again.';
          } else if (err.message.includes('not found') || err.message.includes('Not found')) {
            error = 'Offer not found or may have been deleted.';
          } else if (err.message.includes('Invalid offer ID')) {
            error = 'Invalid offer ID. Please check the URL.';
          } else {
            // Show the actual error message but clean it up
            const cleanMessage = err.message.replace(/^(OfferError: )?Failed to get offer: /, '');
            error = `Unable to load offer: ${cleanMessage}`;
          }
        } else {
          error = 'An unexpected error occurred. Please try again.';
        }
      } finally {
        isLoading = false;
      }
    }

    loadOfferData();
  });
</script>

<svelte:head>
  <title>
    {offer ? `${offer.title} Offer` : 'Offer'} - Requests & Offers
  </title>
  <meta
    name="description"
    content={offer ? `Offer details for ${offer.title} - ${offer.description}` : 'Offer details'}
  />
</svelte:head>

<section class="container mx-auto space-y-6 p-4">
  <!-- Navigation -->
  <div class="flex items-center justify-between">
    <button class="variant-soft btn space-x-2" onclick={() => goto('/offers')}>
      <span>🡰</span>
      <span>Back to Offers</span>
    </button>

    {#if offer && (canEdit || canDelete)}
      <div class="flex gap-2">
        {#if canEdit}
          <button class="variant-filled-secondary btn" onclick={handleEdit}> Edit </button>
        {/if}

        {#if canDelete || agentIsAdministrator}
          <button class="variant-filled-error btn" onclick={handleDelete}> Delete </button>
        {/if}
      </div>
    {/if}
  </div>

  {#if error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
      <div class="alert-actions">
        <button class="variant-filled-primary btn" onclick={handleRefresh}> Retry </button>
      </div>
    </div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading offer...</p>
    </div>
  {:else if offer}
    <!-- Main Content -->
    <div class="space-y-6">
      <!-- Header Card -->
      <div class="card p-6">
        <header class="mb-6">
          <h1 class="h1 mb-4 flex items-center gap-3 text-primary-500">
            {offer.title}
            <span
              class="chip"
              class:variant-ghost-success={offer.status === ListingStatus.Active}
              class:variant-ghost-tertiary={offer.status === ListingStatus.Archived}
            >
              {offer.status}
            </span>
          </h1>
          <p class="whitespace-pre-line text-lg text-surface-600 dark:text-surface-400">
            {offer.description || 'No description provided.'}
          </p>
        </header>

        <!-- Service Types -->
        <section class="mb-6">
          <h3 class="h4 mb-3 font-semibold">Service Types</h3>
          {#if offer.service_type_hashes && offer.service_type_hashes.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each offer.service_type_hashes as serviceTypeHash}
                <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} showLink={true} />
              {/each}
            </div>
          {:else}
            <p class="text-surface-500">No service types specified.</p>
          {/if}
        </section>

        <!-- Medium of Exchange -->
        <section class="mb-6">
          <h3 class="h4 mb-3 font-semibold">Medium of Exchange</h3>
          {#if offer.medium_of_exchange_hashes && offer.medium_of_exchange_hashes.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each offer.medium_of_exchange_hashes as mediumHash}
                <MediumOfExchangeTag mediumOfExchangeActionHash={mediumHash} />
              {/each}
            </div>
          {:else}
            <p class="text-surface-500">No medium of exchange specified.</p>
          {/if}
        </section>

        <!-- Offer Details Grid -->
        {#if offer.time_zone || offer.time_preference || offer.interaction_type}
          <section class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <!-- Time Information -->
            {#if offer.time_zone || offer.time_preference}
              <div>
                <h3 class="h4 mb-2 font-semibold">Time Information</h3>
                {#if offer.time_zone}
                  <p><strong>Time Zone:</strong> {offer.time_zone}</p>
                {/if}
                <p>
                  <strong>Time Preference:</strong>
                  {TimePreferenceHelpers.getDisplayValue(offer.time_preference)}
                </p>
              </div>
            {/if}

            <!-- Interaction Type -->
            {#if offer.interaction_type}
              <div>
                <h3 class="h4 mb-2 font-semibold">Interaction Type</h3>
                <p>{offer.interaction_type === 'Virtual' ? 'Virtual' : 'In Person'}</p>
              </div>
            {/if}
          </section>
        {/if}

        <!-- Links -->
        {#if offer.links && offer.links.length > 0}
          <section class="mt-6">
            <h3 class="h4 mb-3 font-semibold">Related Links</h3>
            <ul class="list-inside list-disc space-y-1">
              {#each offer.links as link}
                <li>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-500 hover:underline dark:text-primary-400"
                  >
                    {link}
                  </a>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      </div>

      <!-- Creator/Organization Info -->
      <div class="card p-6">
        {#if offer.organization}
          <!-- Organization info -->
          <div>
            <h3 class="h4 mb-4 font-semibold">Organization</h3>
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
                        <span class="text-lg font-semibold">
                          {organization.name ? organization.name.charAt(0).toUpperCase() : 'O'}
                        </span>
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
              <div class="mt-4">
                <p class="mb-2 text-sm font-medium">Exchange Coordinators:</p>
                <div class="flex flex-wrap gap-2">
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
        {:else}
          <!-- Creator info (only show if not an organization offer) -->
          <div>
            <h3 class="h4 mb-4 font-semibold">Creator</h3>
            <div class="flex items-center gap-2">
              {#if creator}
                <a href={`/users/${encodeHashToBase64(creator.original_action_hash!)}`}>
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
                          <span class="text-lg font-semibold">
                            {creator.name ? creator.name.charAt(0).toUpperCase() : 'U'}
                          </span>
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
                </a>
              {:else if offer.creator}
                <a
                  href={`/users/${encodeHashToBase64(offer.creator)}`}
                  class="text-primary-500 hover:underline dark:text-primary-400"
                >
                  View Creator Profile
                </a>
              {:else}
                <span class="italic text-surface-500">Unknown creator</span>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Notice for interested users -->
    {#if currentUser && offer?.creator?.toString() !== currentUser?.original_action_hash?.toString()}
      {#if currentUser && !isUserApproved(currentUser)}
        <!-- User needs approval -->
        <div class="card variant-soft-warning p-4">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined">info</span>
            <p class="text-sm">
              Your account is pending approval before you can respond to offers.
            </p>
          </div>
        </div>
      {:else}
        <!-- Instructions for contacting -->
        <div class="card variant-soft-primary p-4">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined">info</span>
            <p class="text-sm">
              Use the contact information below to get in touch with the creator directly.
            </p>
          </div>
        </div>
      {/if}
    {/if}

    <!-- Contact Information -->
    <ContactButton user={creator} {organization} listingType="offer" listingTitle={offer?.title} />

    <!-- Metadata Footer -->
    <div class="text-center text-sm text-surface-500 dark:text-surface-400">
      <p>Created {createdAt()} {updatedAt() !== 'N/A' ? `• Updated ${updatedAt()}` : ''}</p>
    </div>
  {:else}
    <div class="card p-8 text-center">
      <h2 class="h2 mb-4">Offer Not Found</h2>
      <p class="mb-4 text-surface-600 dark:text-surface-400">
        The requested offer could not be found or may have been removed.
      </p>
      <button class="variant-filled-primary btn" onclick={() => goto('/offers')}>
        Browse All Offers
      </button>
    </div>
  {/if}
</section>
