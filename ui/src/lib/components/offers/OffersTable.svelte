<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIOffer, UIUser, UIOrganization } from '$lib/types/ui';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import OfferCard from '$lib/components/offers/OfferCard.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import OfferDetailsModal from '$lib/components/offers/OfferDetailsModal.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';

  type Props = {
    offers: readonly UIOffer[];
    title?: string;
    showOrganization?: boolean;
    showCreator?: boolean;
  };

  const { offers, title, showOrganization = false, showCreator = false }: Props = $props();

  const modalStore = getModalStore();
  const modalComponent: ModalComponent = { ref: OfferDetailsModal };

  // Reactive state for creator and organization details
  const loadingCreators = $state<Record<string, boolean>>({});
  const loadingOrganizations = $state<Record<string, boolean>>({});
  const creatorDetails = $state<Record<string, UIUser | null>>({});
  let organizationDetails = $state<Record<string, UIOrganization | null>>({});

  // Fetch creator details
  $effect(() => {
    if (!showCreator) return;

    const creatorHashes = offers
      .map((offer) => offer.creator)
      .filter((hash): hash is NonNullable<typeof hash> => hash !== undefined);

    creatorHashes.forEach(async (hash) => {
      const creatorHash = encodeHashToBase64(hash);
      if (creatorDetails[creatorHash] === undefined && !loadingCreators[creatorHash]) {
        loadingCreators[creatorHash] = true;
        try {
          const creator = await usersStore.getUserByActionHash(hash);
          creatorDetails[creatorHash] = creator;
        } catch (error) {
          console.error('Error loading creator:', error);
          creatorDetails[creatorHash] = null;
        } finally {
          loadingCreators[creatorHash] = false;
        }
      }
    });
  });

  // Fetch organization details
  $effect(() => {
    if (!showOrganization) return;

    const orgHashes = offers
      .map((offer) => offer.organization)
      .filter((hash): hash is NonNullable<typeof hash> => hash !== undefined);

    orgHashes.forEach(async (hash) => {
      const orgHash = encodeHashToBase64(hash);
      if (organizationDetails[orgHash] === undefined && !loadingOrganizations[orgHash]) {
        loadingOrganizations[orgHash] = true;
        try {
          const organization = await organizationsStore.getOrganizationByActionHash(hash);
          organizationDetails[orgHash] = organization;
          // Force reactivity update
          organizationDetails = { ...organizationDetails };
        } catch (error) {
          console.error('Error loading organization:', error);
          organizationDetails[orgHash] = null;
        } finally {
          loadingOrganizations[orgHash] = false;
        }
      }
    });
  });

  function handleOfferAction(offer: UIOffer) {
    if (page.url.pathname.startsWith('/admin')) {
      // Use modal view for admin
      modalStore.trigger({
        type: 'component',
        component: modalComponent,
        meta: { offer }
      });
    } else {
      // Navigate to offer details page
      goto(`/offers/${encodeHashToBase64(offer.original_action_hash!)}`);
    }
  }

  // Get creator display name
  function getCreatorDisplay(offer: UIOffer): string {
    if (!offer.creator) return 'Unknown';
    const creatorHash = encodeHashToBase64(offer.creator);

    if (loadingCreators[creatorHash]) return 'Loading...';

    const creator = creatorDetails[creatorHash];
    return creator ? creator.name || 'Unnamed User' : 'Unknown User';
  }

  type OrganizationDisplay = 'No Organization' | 'Unknown Organization' | string;

  // Get organization display name
  function getOrganizationDisplay(offer: UIOffer): OrganizationDisplay {
    if (!offer.organization) return 'No Organization';
    const orgHash = encodeHashToBase64(offer.organization);

    if (loadingOrganizations[orgHash]) return 'Loading...';

    const organization = organizationDetails[orgHash];
    if (!organization) return 'Unknown Organization';

    return organization.name || 'Unnamed Organization';
  }
</script>

<div class="flex flex-col gap-4">
  {#if title}
    <h2 class="h3 text-center font-semibold">{title}</h2>
  {/if}

  {#if offers.length > 0}
    <!-- Table view for larger screens -->
    <div class="hidden overflow-x-auto lg:block">
      <table class="table-hover table w-full drop-shadow-lg">
        <thead>
          <tr>
            <th class="w-1/5 min-w-32">Title</th>
            <th class="w-2/5 min-w-48">Description</th>
            <th class="w-1/5 min-w-32">Service Types</th>
            {#if showCreator}
              <th class="w-1/6 min-w-28">Creator</th>
            {/if}
            {#if showOrganization}
              <th class="w-1/6 min-w-28">Organization</th>
            {/if}
            <th class="w-20">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each offers as offer}
            <tr>
              <td class="max-w-32">
                <div class="truncate font-medium" title={offer.title}>
                  {offer.title}
                </div>
              </td>
              <td class="max-w-48">
                <div class="truncate text-sm" title={offer.description}>
                  {offer.description}
                </div>
              </td>
              <td class="max-w-32">
                {#if offer.service_type_hashes && offer.service_type_hashes.length > 0}
                  <div class="flex flex-col gap-1">
                    <ServiceTypeTag serviceTypeActionHash={offer.service_type_hashes[0]!} />
                    {#if offer.service_type_hashes.length > 1}
                      <span class="badge variant-soft-secondary self-start text-xs"
                        >+{offer.service_type_hashes.length - 1} more</span
                      >
                    {/if}
                  </div>
                {:else}
                  <span class="text-surface-500 text-xs">No service types</span>
                {/if}
              </td>
              {#if showCreator}
                <td class="max-w-28">
                  <a
                    class="text-primary-500 dark:text-primary-400 block truncate text-sm hover:underline"
                    href={`/users/${encodeHashToBase64(offer.creator!)}`}
                    title={getCreatorDisplay(offer)}
                  >
                    {getCreatorDisplay(offer)}
                  </a>
                </td>
              {/if}
              {#if showOrganization}
                <td class="max-w-28">
                  {#if getOrganizationDisplay(offer) !== 'No Organization' && getOrganizationDisplay(offer) !== 'Unknown Organization'}
                    <a
                      href={`/organizations/${encodeHashToBase64(offer.organization!)}`}
                      class="text-primary-500 dark:text-primary-400 block truncate text-sm hover:underline"
                      title={getOrganizationDisplay(offer)}
                    >
                      {getOrganizationDisplay(offer)}
                    </a>
                  {:else}
                    <span
                      class="text-surface-500 block truncate text-sm"
                      title={getOrganizationDisplay(offer)}
                    >
                      {getOrganizationDisplay(offer)}
                    </span>
                  {/if}
                </td>
              {/if}
              <td>
                <button
                  class="btn variant-filled-secondary btn-sm"
                  onclick={() => handleOfferAction(offer)}
                >
                  {page.url.pathname.startsWith('/admin') ? 'View' : 'Details'}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Tablet view with simplified layout -->
    <div class="hidden overflow-x-auto md:block lg:hidden">
      <table class="table-hover table w-full text-sm drop-shadow-lg">
        <thead>
          <tr>
            <th class="w-2/5">Offer</th>
            <th class="w-1/5">Service Types</th>
            {#if showCreator && !showOrganization}
              <th class="w-1/5">Creator</th>
            {:else if showOrganization && !showCreator}
              <th class="w-1/5">Organization</th>
            {:else if showCreator && showOrganization}
              <th class="w-1/5">Creator/Org</th>
            {/if}
            <th class="w-1/5">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each offers as offer}
            <tr>
              <td class="max-w-48">
                <div class="space-y-1">
                  <div class="truncate font-medium" title={offer.title}>{offer.title}</div>
                  <div
                    class="text-surface-600-300-token truncate text-xs"
                    title={offer.description}
                  >
                    {offer.description}
                  </div>
                </div>
              </td>
              <td class="max-w-32">
                {#if offer.service_type_hashes && offer.service_type_hashes.length > 0}
                  <ServiceTypeTag serviceTypeActionHash={offer.service_type_hashes[0]!} />
                  {#if offer.service_type_hashes.length > 1}
                    <div class="text-surface-500 mt-1 text-xs">
                      +{offer.service_type_hashes.length - 1} more
                    </div>
                  {/if}
                {:else}
                  <span class="text-surface-500 text-xs">No service types</span>
                {/if}
              </td>
              {#if showCreator && !showOrganization}
                <td class="max-w-28">
                  <a
                    class="text-primary-500 dark:text-primary-400 block truncate text-xs hover:underline"
                    href={`/users/${encodeHashToBase64(offer.creator!)}`}
                  >
                    {getCreatorDisplay(offer)}
                  </a>
                </td>
              {:else if showOrganization && !showCreator}
                <td class="max-w-28">
                  {#if getOrganizationDisplay(offer) !== 'No Organization' && getOrganizationDisplay(offer) !== 'Unknown Organization'}
                    <a
                      href={`/organizations/${encodeHashToBase64(offer.organization!)}`}
                      class="text-primary-500 dark:text-primary-400 block truncate text-xs hover:underline"
                    >
                      {getOrganizationDisplay(offer)}
                    </a>
                  {:else}
                    <span class="text-surface-500 block truncate text-xs">
                      {getOrganizationDisplay(offer)}
                    </span>
                  {/if}
                </td>
              {:else if showCreator && showOrganization}
                <td class="max-w-28">
                  <div class="space-y-1">
                    <a
                      class="text-primary-500 dark:text-primary-400 block truncate text-xs hover:underline"
                      href={`/users/${encodeHashToBase64(offer.creator!)}`}
                    >
                      {getCreatorDisplay(offer)}
                    </a>
                    {#if getOrganizationDisplay(offer) !== 'No Organization'}
                      <div class="text-surface-500 truncate text-xs">
                        {getOrganizationDisplay(offer)}
                      </div>
                    {/if}
                  </div>
                </td>
              {/if}
              <td>
                <button
                  class="btn variant-filled-secondary btn-sm"
                  onclick={() => handleOfferAction(offer)}
                >
                  Details
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Card view for mobile screens -->
    <div class="grid grid-cols-1 gap-3 md:hidden">
      {#each offers as offer}
        <div class="card variant-ghost-surface p-4">
          <div class="space-y-3">
            <!-- Title and Action -->
            <div class="flex items-start justify-between gap-3">
              <h3 class="h5 flex-1 truncate font-semibold" title={offer.title}>
                {offer.title}
              </h3>
              <button
                class="btn variant-filled-secondary btn-sm shrink-0"
                onclick={() => handleOfferAction(offer)}
              >
                Details
              </button>
            </div>

            <!-- Description -->
            <p class="text-surface-600-300-token line-clamp-2 text-sm" title={offer.description}>
              {offer.description}
            </p>

            <!-- Service Types -->
            {#if offer.service_type_hashes && offer.service_type_hashes.length > 0}
              <div class="space-y-2">
                <span class="text-surface-500 text-xs font-medium">Service Types:</span>
                <div class="flex flex-wrap gap-2">
                  {#each offer.service_type_hashes.slice(0, 3) as serviceTypeHash}
                    <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} />
                  {/each}
                  {#if offer.service_type_hashes.length > 3}
                    <span class="badge variant-soft-secondary text-xs">
                      +{offer.service_type_hashes.length - 3} more
                    </span>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="space-y-2">
                <span class="text-surface-500 text-xs font-medium">Service Types:</span>
                <span class="text-surface-500 text-xs">No service types assigned</span>
              </div>
            {/if}

            <!-- Creator and Organization -->
            {#if showCreator || showOrganization}
              <div class="text-surface-600-300-token flex flex-wrap gap-4 text-xs">
                {#if showCreator && offer.creator}
                  <div>
                    Created by:
                    <a
                      class="text-primary-500 dark:text-primary-400 hover:underline"
                      href={`/users/${encodeHashToBase64(offer.creator)}`}
                    >
                      {getCreatorDisplay(offer)}
                    </a>
                  </div>
                {/if}
                {#if showOrganization && offer.organization && getOrganizationDisplay(offer) !== 'No Organization'}
                  <div>
                    Organization:
                    <a
                      class="text-primary-500 dark:text-primary-400 hover:underline"
                      href={`/organizations/${encodeHashToBase64(offer.organization)}`}
                    >
                      {getOrganizationDisplay(offer)}
                    </a>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-surface-500 text-center">No offers found.</p>
  {/if}
</div>
