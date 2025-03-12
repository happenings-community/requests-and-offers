<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIRequest, UIUser, UIOrganization } from '@/types/ui';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import RequestCard from '@/lib/components/RequestCard.svelte';
  import RequestDetailsModal from '@/lib/modals/RequestDetailsModal.svelte';
  import usersStore from '@/stores/users.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';

  type Props = {
    requests: UIRequest[];
    title?: string;
    showOrganization?: boolean;
    showCreator?: boolean;
  };

  const { requests, title, showOrganization = false, showCreator = false }: Props = $props();

  const modalStore = getModalStore();
  const modalComponent: ModalComponent = { ref: RequestDetailsModal };

  // Reactive state for creator and organization details
  const creatorDetails = $state<Record<string, UIUser | null>>({});
  let organizationDetails = $state<Record<string, UIOrganization | null>>({});
  const loadingCreators = $state<Record<string, boolean>>({});
  const loadingOrganizations = $state<Record<string, boolean>>({});

  // Fetch creator details
  $effect(() => {
    if (!showCreator) return;

    const creatorHashes = requests
      .map((request) => request.creator)
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

    const orgHashes = requests
      .map((request) => request.organization)
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

  function handleRequestAction(request: UIRequest) {
    if (page.url.pathname.startsWith('/admin')) {
      // Use modal view for admin
      modalStore.trigger({
        type: 'component',
        component: modalComponent,
        meta: { request }
      });
    } else {
      // Navigate to request details page
      goto(`/requests/${encodeHashToBase64(request.original_action_hash!)}`);
    }
  }

  // Compute skills display
  function getSkillsDisplay(skills: string[]) {
    if (skills.length === 0) return null;
    return skills.length > 1 ? `${skills[0]} +${skills.length - 1} more` : skills[0];
  }

  // Get creator display name
  function getCreatorDisplay(request: UIRequest): string {
    if (!request.creator) return 'Unknown';
    const creatorHash = encodeHashToBase64(request.creator);

    if (loadingCreators[creatorHash]) return 'Loading...';

    const creator = creatorDetails[creatorHash];
    return creator ? creator.name || 'Unnamed User' : 'Unknown User';
  }

  // Get organization display name
  function getOrganizationDisplay(request: UIRequest): string {
    if (!request.organization) return 'No Organization';
    const orgHash = encodeHashToBase64(request.organization);

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

  {#if requests.length > 0}
    <!-- Table view for larger screens -->
    <div class="hidden overflow-x-auto md:block">
      <table class="table-hover table w-full drop-shadow-lg">
        <thead>
          <tr>
            <th class="whitespace-nowrap">Title</th>
            <th class="whitespace-nowrap">Description</th>
            <th class="whitespace-nowrap">Skills</th>
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
          {#each requests as request}
            <tr>
              <td class="whitespace-nowrap">{request.title}</td>
              <td class="max-w-md truncate">{request.description}</td>
              <td class="whitespace-nowrap">
                {#if request.skills.length > 0}
                  <span class="chip variant-soft-primary">
                    {getSkillsDisplay(request.skills)}
                  </span>
                {/if}
              </td>

              {#if showCreator}
                <td class="whitespace-nowrap">
                  {getCreatorDisplay(request)}
                </td>
              {/if}
              {#if showOrganization}
                <td class="whitespace-nowrap">
                  {getOrganizationDisplay(request)}
                </td>
              {/if}
              <td class="whitespace-nowrap">
                <button
                  class="btn variant-filled-secondary"
                  onclick={() => handleRequestAction(request)}
                >
                  {page.url.pathname.startsWith('/admin') ? 'Manage' : 'Details'}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Card view for mobile screens -->
    <div class="grid grid-cols-1 gap-4 md:hidden">
      {#each requests as request}
        <button onclick={() => handleRequestAction(request)} class="cursor-pointer">
          <RequestCard {request} mode="compact" />
          {#if showCreator && request.creator}
            <div class="text-surface-600-300-token mt-1 text-xs">
              Created by: {getCreatorDisplay(request)}
            </div>
          {/if}
        </button>
      {/each}
    </div>
  {:else}
    <p class="text-surface-500 text-center">No requests found.</p>
  {/if}
</div>
