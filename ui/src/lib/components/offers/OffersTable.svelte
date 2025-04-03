<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIOffer, UIUser, UIOrganization } from '@types/ui';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import OfferCard from '@components/OfferCard.svelte';
  import usersStore from '@stores/users.store.svelte';
  import organizationsStore from '@stores/organizations.store.svelte';
  import OfferDetailsModal from '../modals/OfferDetailsModal.svelte';

  type Props = {
    offers: UIOffer[];
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

  // Compute capabilities display
  function getCapabilitiesDisplay(capabilities: string[]) {
    if (capabilities.length === 0) return null;
    return capabilities.length > 1
      ? `${capabilities[0]} +${capabilities.length - 1} more`
      : capabilities[0];
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
    <div class="hidden overflow-x-auto md:block">
      <table class="table-hover table w-full drop-shadow-lg">
        <thead>
          <tr>
            <th class="whitespace-nowrap">Title</th>
            <th class="whitespace-nowrap">Description</th>
            <th class="whitespace-nowrap">Capabilities</th>
            {#if showCreator}
              <th class="whitespace-nowrap">Creator</th>
            {/if}
            {#if showOrganization}
              <th class="whitespace-nowrap">Organization</th>
            {/if}
            <th class="whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each offers as offer}
            <tr>
              <td class="whitespace-nowrap">{offer.title}</td>
              <td class="max-w-md truncate">{offer.description}</td>
              <td class="whitespace-nowrap">
                {getCapabilitiesDisplay(offer.capabilities) || 'None'}
              </td>
              {#if showCreator}
                <td class="whitespace-nowrap">
                  <a
                    class="text-primary-500 dark:text-primary-400 hover:underline"
                    href={`/users/${encodeHashToBase64(offer.creator!)}`}
                  >
                    {getCreatorDisplay(offer)}
                  </a>
                </td>
              {/if}
              {#if showOrganization}
                <td class="whitespace-nowrap">
                  {#if getOrganizationDisplay(offer) !== 'No Organization' && getOrganizationDisplay(offer) !== 'Unknown Organization'}
                    <a
                      href={`/organizations/${encodeHashToBase64(offer.organization!)}`}
                      class="text-primary-500 dark:text-primary-400 hover:underline"
                    >
                      {getOrganizationDisplay(offer)}
                    </a>
                  {:else}
                    <span class="text-surface-500">{getOrganizationDisplay(offer)}</span>
                  {/if}
                </td>
              {/if}
              <td class="whitespace-nowrap">
                <button
                  class="btn variant-filled-secondary"
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

    <!-- Card view for mobile screens -->
    <div class="grid grid-cols-1 gap-4 md:hidden">
      {#each offers as offer}
        <button class="cursor-pointer" onclick={() => handleOfferAction(offer)}>
          <OfferCard {offer} mode="compact" />
          {#if showCreator && offer.creator}
            <div class="text-surface-600-300-token mt-1 text-xs">
              Created by:
              <a
                class="text-primary-500 dark:text-primary-400 hover:underline"
                href={`/users/${encodeHashToBase64(offer.creator)}`}
              >
                {getCreatorDisplay(offer)}
              </a>
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {:else}
    <p class="text-surface-500 text-center">No offers found.</p>
  {/if}
</div>
