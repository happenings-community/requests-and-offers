<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import type { UIRequest, UIUser, UIOrganization } from '$lib/types/ui';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import RequestCard from '$lib/components/requests/RequestCard.svelte';
  import RequestDetailsModal from '$lib/components/requests/RequestDetailsModal.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import { Effect as E } from 'effect';
import { runEffect } from '$lib/utils/effect';

  type Props = {
    requests: readonly UIRequest[];
    title?: string;
    showOrganization?: boolean;
    showCreator?: boolean;
  };

  const { requests, title, showOrganization = false, showCreator = false }: Props = $props();

  const modalStore = getModalStore();
  const modalComponent: ModalComponent = { ref: RequestDetailsModal };

  // Reactive state for creator and organization details
  const loadingCreators = $state<Record<string, boolean>>({});
  const loadingOrganizations = $state<Record<string, boolean>>({});
  const creatorDetails = $state<Record<string, UIUser | null>>({});
  let organizationDetails = $state<Record<string, UIOrganization | null>>({});

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
          const creator = await runEffect(usersStore.getUserByActionHash(hash));
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
          const organization = await runEffect(
            organizationsStore.getOrganizationByActionHash(hash)
          );
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

  // Get creator display name
  function getCreatorDisplay(request: UIRequest): string {
    if (!request.creator) return 'Unknown';
    const creatorHash = encodeHashToBase64(request.creator);

    if (loadingCreators[creatorHash]) return 'Loading...';

    const creator = creatorDetails[creatorHash];
    return creator ? creator.name || 'Unnamed User' : 'Unknown User';
  }

  type OrganizationDisplay = 'No Organization' | 'Unknown Organization' | string;

  // Get organization display name
  function getOrganizationDisplay(request: UIRequest): OrganizationDisplay {
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
    <div class="hidden overflow-x-auto lg:block">
      <table class="table table-hover w-full drop-shadow-lg">
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
          {#each requests as request}
            <tr>
              <td class="max-w-32">
                <div class="truncate font-medium" title={request.title}>
                  {request.title}
                </div>
              </td>
              <td class="max-w-48">
                <div class="truncate text-sm" title={request.description}>
                  {request.description}
                </div>
              </td>
              <td class="max-w-32">
                {#if request.service_type_hashes && request.service_type_hashes.length > 0}
                  <div class="flex flex-col gap-1">
                    <ServiceTypeTag serviceTypeActionHash={request.service_type_hashes[0]!} />
                    {#if request.service_type_hashes.length > 1}
                      <span class="variant-soft-secondary badge self-start text-xs"
                        >+{request.service_type_hashes.length - 1} more</span
                      >
                    {/if}
                  </div>
                {:else}
                  <span class="text-xs text-surface-500">No service types</span>
                {/if}
              </td>
              {#if showCreator}
                <td class="max-w-28">
                  <a
                    class="block truncate text-sm text-primary-500 hover:underline dark:text-primary-400"
                    href={`/users/${encodeHashToBase64(request.creator!)}`}
                    title={getCreatorDisplay(request)}
                  >
                    {getCreatorDisplay(request)}
                  </a>
                </td>
              {/if}
              {#if showOrganization}
                <td class="max-w-28">
                  {#if getOrganizationDisplay(request) !== 'No Organization' && getOrganizationDisplay(request) !== 'Unknown Organization'}
                    <a
                      href={`/organizations/${encodeHashToBase64(request.organization!)}`}
                      class="block truncate text-sm text-primary-500 hover:underline dark:text-primary-400"
                      title={getOrganizationDisplay(request)}
                    >
                      {getOrganizationDisplay(request)}
                    </a>
                  {:else}
                    <span
                      class="block truncate text-sm text-surface-500"
                      title={getOrganizationDisplay(request)}
                    >
                      {getOrganizationDisplay(request)}
                    </span>
                  {/if}
                </td>
              {/if}
              <td>
                <button
                  class="variant-filled-secondary btn btn-sm"
                  onclick={() => handleRequestAction(request)}
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
      <table class="table table-hover w-full text-sm drop-shadow-lg">
        <thead>
          <tr>
            <th class="w-2/5">Request</th>
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
          {#each requests as request}
            <tr>
              <td class="max-w-48">
                <div class="space-y-1">
                  <div class="truncate font-medium" title={request.title}>{request.title}</div>
                  <div
                    class="text-surface-600-300-token truncate text-xs"
                    title={request.description}
                  >
                    {request.description}
                  </div>
                </div>
              </td>
              <td class="max-w-32">
                {#if request.service_type_hashes && request.service_type_hashes.length > 0}
                  <ServiceTypeTag serviceTypeActionHash={request.service_type_hashes[0]!} />
                  {#if request.service_type_hashes.length > 1}
                    <div class="mt-1 text-xs text-surface-500">
                      +{request.service_type_hashes.length - 1} more
                    </div>
                  {/if}
                {:else}
                  <span class="text-xs text-surface-500">No service types</span>
                {/if}
              </td>
              {#if showCreator && !showOrganization}
                <td class="max-w-28">
                  <a
                    class="block truncate text-xs text-primary-500 hover:underline dark:text-primary-400"
                    href={`/users/${encodeHashToBase64(request.creator!)}`}
                  >
                    {getCreatorDisplay(request)}
                  </a>
                </td>
              {:else if showOrganization && !showCreator}
                <td class="max-w-28">
                  {#if getOrganizationDisplay(request) !== 'No Organization' && getOrganizationDisplay(request) !== 'Unknown Organization'}
                    <a
                      href={`/organizations/${encodeHashToBase64(request.organization!)}`}
                      class="block truncate text-xs text-primary-500 hover:underline dark:text-primary-400"
                    >
                      {getOrganizationDisplay(request)}
                    </a>
                  {:else}
                    <span class="block truncate text-xs text-surface-500">
                      {getOrganizationDisplay(request)}
                    </span>
                  {/if}
                </td>
              {:else if showCreator && showOrganization}
                <td class="max-w-28">
                  <div class="space-y-1">
                    <a
                      class="block truncate text-xs text-primary-500 hover:underline dark:text-primary-400"
                      href={`/users/${encodeHashToBase64(request.creator!)}`}
                    >
                      {getCreatorDisplay(request)}
                    </a>
                    {#if getOrganizationDisplay(request) !== 'No Organization'}
                      <div class="truncate text-xs text-surface-500">
                        {getOrganizationDisplay(request)}
                      </div>
                    {/if}
                  </div>
                </td>
              {/if}
              <td>
                <button
                  class="variant-filled-secondary btn btn-sm"
                  onclick={() => handleRequestAction(request)}
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
      {#each requests as request}
        <div class="card variant-ghost-surface p-4">
          <div class="space-y-3">
            <!-- Title and Action -->
            <div class="flex items-start justify-between gap-3">
              <h3 class="h5 flex-1 truncate font-semibold" title={request.title}>
                {request.title}
              </h3>
              <button
                class="variant-filled-secondary btn btn-sm shrink-0"
                onclick={() => handleRequestAction(request)}
              >
                Details
              </button>
            </div>

            <!-- Description -->
            <p class="text-surface-600-300-token line-clamp-2 text-sm" title={request.description}>
              {request.description}
            </p>

            <!-- Service Types -->
            {#if request.service_type_hashes && request.service_type_hashes.length > 0}
              <div class="space-y-2">
                <span class="text-xs font-medium text-surface-500">Service Types:</span>
                <div class="flex flex-wrap gap-2">
                  {#each request.service_type_hashes.slice(0, 3) as serviceTypeHash}
                    <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} />
                  {/each}
                  {#if request.service_type_hashes.length > 3}
                    <span class="variant-soft-secondary badge text-xs">
                      +{request.service_type_hashes.length - 3} more
                    </span>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="space-y-2">
                <span class="text-xs font-medium text-surface-500">Service Types:</span>
                <span class="text-xs text-surface-500">No service types assigned</span>
              </div>
            {/if}

            <!-- Creator and Organization -->
            {#if showCreator || showOrganization}
              <div class="text-surface-600-300-token flex flex-wrap gap-4 text-xs">
                {#if showCreator && request.creator}
                  <div>
                    Created by:
                    <a
                      class="text-primary-500 hover:underline dark:text-primary-400"
                      href={`/users/${encodeHashToBase64(request.creator)}`}
                    >
                      {getCreatorDisplay(request)}
                    </a>
                  </div>
                {/if}
                {#if showOrganization && request.organization && getOrganizationDisplay(request) !== 'No Organization'}
                  <div>
                    Organization:
                    <a
                      class="text-primary-500 hover:underline dark:text-primary-400"
                      href={`/organizations/${encodeHashToBase64(request.organization)}`}
                    >
                      {getOrganizationDisplay(request)}
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
    <p class="text-center text-surface-500">No requests found.</p>
  {/if}
</div>
