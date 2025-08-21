<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { formatDate, getUserPictureUrl, getOrganizationLogoUrl } from '$lib/utils';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import MediumOfExchangeTag from '$lib/components/mediums-of-exchange/MediumOfExchangeTag.svelte';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalComponent } from '@skeletonlabs/skeleton';
  import { isUserApproved } from '$lib/utils';
  import type { UIRequest, UIUser, UIOrganization } from '$lib/types/ui';
  import { ContactPreferenceHelpers, TimePreferenceHelpers } from '$lib/types/holochain';
  import { runEffect } from '$lib/utils/effect';
  import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
  import { useAdminStatusGuard } from '$lib/composables/connection/useAdminStatusGuard.svelte';
  import { openCreateProposalModal } from '$lib/utils/exchange-proposal';

  const toastStore = getToastStore();
  const modalStore = getModalStore();

  // Get request ID from route params
  const requestId = $derived(page.params.id);
  const requestHash = $derived(() => {
    try {
      return requestId ? decodeHashFromBase64(requestId) : null;
    } catch {
      return null;
    }
  });

  // State
  let request: UIRequest | null = $state(null);
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
    if (!request || !currentUser?.original_action_hash) return false;

    // User can edit if they created the request
    if (request.creator) {
      return request.creator.toString() === currentUser.original_action_hash.toString();
    }

    // Admin can edit any request
    if (agentIsAdministrator) {
      return true;
    }

    // User can edit if they are an organization coordinator
    if (request.organization && organization?.coordinators) {
      return organization.coordinators.some(
        (coord) => coord.toString() === currentUser.original_action_hash?.toString()
      );
    }

    return false;
  });

  const canDelete = $derived.by(() => {
    if (!request || !currentUser?.original_action_hash) return false;

    // User can delete if they created the request
    if (request.creator) {
      return request.creator.toString() === currentUser.original_action_hash.toString();
    }

    // Admin can delete any request
    if (agentIsAdministrator) {
      return true;
    }

    // User can delete if they are an organization coordinator
    if (request.organization && organization?.coordinators) {
      return organization.coordinators.some(
        (coord) => coord.toString() === currentUser.original_action_hash?.toString()
      );
    }

    return false;
  });

  // Check if user can respond to this request
  const canRespond = $derived.by(() => {
    if (!currentUser || !isUserApproved(currentUser) || !request) return false;

    // Users cannot respond to their own requests
    if (request.creator?.toString() === currentUser.original_action_hash?.toString()) {
      return false;
    }

    // Check if user is part of the organization (if it's an org request)
    if (request.organization && currentUser.organizations) {
      const isOrgMember = currentUser.organizations.some(
        (org) => org.toString() === request!.organization!.toString()
      );
      if (isOrgMember) return false;
    }

    return true;
  });

  // Modal trigger function for creating exchange proposals
  function handleCreateProposal() {
    if (!request?.original_action_hash || !canRespond) return;

    openCreateProposalModal(
      modalStore,
      request.original_action_hash,
      'request',
      request.title,
      () => {
        // Refresh request data after successful proposal creation
        window.location.reload();
      }
    );
  }

  // Image URLs
  const creatorPictureUrl = $derived.by(() => (creator ? getUserPictureUrl(creator) : null));
  const organizationLogoUrl = $derived.by(() =>
    organization ? getOrganizationLogoUrl(organization) : null
  );

  // Format dates
  const createdAt = $derived(() => {
    if (!request?.created_at) return 'Unknown';
    try {
      return formatDate(new Date(Number(request.created_at)));
    } catch (err) {
      console.error('Error formatting created date:', err);
      return 'Invalid date';
    }
  });

  const updatedAt = $derived(() => {
    if (!request?.updated_at) return 'N/A';
    try {
      return formatDate(new Date(Number(request.updated_at)));
    } catch (err) {
      console.error('Error formatting updated date:', err);
      return 'Invalid date';
    }
  });

  // Actions
  function handleEdit() {
    if (request?.original_action_hash) {
      const id = encodeHashToBase64(request.original_action_hash);
      goto(`/requests/${id}/edit`);
    }
  }

  async function handleDelete() {
    if (!request?.original_action_hash) return;

    if (!confirm('Are you sure you want to delete this request?')) return;

    try {
      await runEffect(requestsStore.deleteRequest(request.original_action_hash));

      toastStore.trigger({
        message: 'Request deleted successfully!',
        background: 'variant-filled-success'
      });

      goto('/requests');
    } catch (err) {
      console.error('Failed to delete request:', err);
      toastStore.trigger({
        message: `Failed to delete request: ${err instanceof Error ? err.message : String(err)}`,
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

  // Load request data
  $effect(() => {
    async function loadRequestData() {
      try {
        isLoading = true;
        error = null;

        if (!requestHash()) {
          error = 'Invalid request ID';
          return;
        }

        // Show connecting message during connection and data load
        error = 'Connecting to network...';

        // Ensure connection using Effect patterns with retry and timeout
        await runEffect(useConnectionGuard());

        // Load request data
        request = await runEffect(requestsStore.getRequest(requestHash()!));

        // Clear the connecting message on success
        error = null;

        if (!request) {
          error = 'Request not found';
          return;
        }

        // Load creator data
        if (request.creator) {
          try {
            creator = await runEffect(usersStore.getUserByActionHash(request.creator));
          } catch (err) {
            console.error('Failed to load creator:', err);
            creator = null;
          }
        }

        // Load organization data
        if (request.organization) {
          try {
            organization = await runEffect(
              organizationsStore.getOrganizationByActionHash(request.organization)
            );
          } catch (err) {
            console.error('Failed to load organization:', err);
            organization = null;
          }
        }
      } catch (err) {
        console.error('Failed to load request data:', err);

        // Handle different types of errors with specific user-friendly messages
        if (err instanceof Error) {
          if (err.message.includes('Connection') || err.message.includes('Client not connected')) {
            error = 'Failed to connect to network. Please refresh the page.';
          } else if (err.message.includes('timeout') || err.message.includes('Timeout')) {
            error = 'Request timed out. Please check your connection and try again.';
          } else if (err.message.includes('not found') || err.message.includes('Not found')) {
            error = 'Request not found or may have been deleted.';
          } else if (err.message.includes('Invalid request ID')) {
            error = 'Invalid request ID. Please check the URL.';
          } else {
            // Show the actual error message but clean it up
            const cleanMessage = err.message.replace(
              /^(RequestError: )?Failed to get request: /,
              ''
            );
            error = `Unable to load request: ${cleanMessage}`;
          }
        } else {
          error = 'An unexpected error occurred. Please try again.';
        }
      } finally {
        isLoading = false;
      }
    }

    loadRequestData();
  });
</script>

<svelte:head>
  <title>
    {request ? `${request.title} Request` : 'Request'} - Requests & Offers
  </title>
  <meta
    name="description"
    content={request
      ? `Request details for ${request.title} - ${request.description}`
      : 'Request details'}
  />
</svelte:head>

<section class="container mx-auto space-y-6 p-4">
  <!-- Navigation -->
  <div class="flex items-center justify-between">
    <button class="variant-soft btn space-x-2" onclick={() => goto('/requests')}>
      <span>🡰</span>
      <span>Back to Requests</span>
    </button>

    {#if request && (canEdit || canDelete)}
      <div class="flex gap-2">
        {#if canEdit || agentIsAdministrator}
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
      <p class="ml-4">Loading request...</p>
    </div>
  {:else if request}
    <!-- Main Content -->
    <div class="space-y-6">
      <!-- Header Card -->
      <div class="card p-6">
        <header class="mb-6">
          <h1 class="h1 mb-4 text-primary-500">{request.title}</h1>
          <p class="whitespace-pre-line text-lg text-surface-600 dark:text-surface-400">
            {request.description || 'No description provided.'}
          </p>
        </header>

        <!-- Service Types -->
        <section class="mb-6">
          <h3 class="h4 mb-3 font-semibold">Service Types</h3>
          {#if request.service_type_hashes && request.service_type_hashes.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each request.service_type_hashes as serviceTypeHash}
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
          {#if request.medium_of_exchange_hashes && request.medium_of_exchange_hashes.length > 0}
            <div class="flex flex-wrap gap-2">
              {#each request.medium_of_exchange_hashes as mediumHash}
                <MediumOfExchangeTag mediumOfExchangeActionHash={mediumHash} />
              {/each}
            </div>
          {:else}
            <p class="text-surface-500">No medium of exchange specified.</p>
          {/if}
        </section>

        <!-- Request Details Grid -->
        <section class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <!-- Date Range -->
          {#if request.date_range}
            <div>
              <h3 class="h4 mb-2 font-semibold">Date Range</h3>
              <p>
                {#if request.date_range.start && request.date_range.end}
                  {formatDate(new Date(request.date_range.start))} to {formatDate(
                    new Date(request.date_range.end)
                  )}
                {:else if request.date_range.start}
                  Starting {formatDate(new Date(request.date_range.start))}
                {:else if request.date_range.end}
                  Until {formatDate(new Date(request.date_range.end))}
                {:else}
                  No date range specified
                {/if}
              </p>
            </div>
          {/if}

          <!-- Time Estimate -->
          {#if request.time_estimate_hours !== undefined}
            <div>
              <h3 class="h4 mb-2 font-semibold">Time Estimate</h3>
              <p>{request.time_estimate_hours} hours</p>
            </div>
          {/if}

          <!-- Contact Information -->
          <div>
            <h3 class="h4 mb-2 font-semibold">Contact Information</h3>
            <p><strong>Time Zone:</strong> {request.time_zone || 'Not specified'}</p>
            <p>
              <strong>Time Preference:</strong>
              {TimePreferenceHelpers.getDisplayValue(request.time_preference)}
            </p>
          </div>

          <!-- Interaction Type -->
          {#if request.interaction_type}
            <div>
              <h3 class="h4 mb-2 font-semibold">Interaction Type</h3>
              <p>{request.interaction_type === 'Virtual' ? 'Virtual' : 'In Person'}</p>
            </div>
          {/if}
        </section>

        <!-- Links -->
        {#if request.links && request.links.length > 0}
          <section class="mt-6">
            <h3 class="h4 mb-3 font-semibold">Related Links</h3>
            <ul class="list-inside list-disc space-y-1">
              {#each request.links as link}
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
        {#if request.organization}
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
                  href={`/organizations/${encodeHashToBase64(request.organization)}`}
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
          <!-- Creator info (only show if not an organization request) -->
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
              {:else if request.creator}
                <a
                  href={`/users/${encodeHashToBase64(request.creator)}`}
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

    <!-- Direct Response Button -->
    {#if canRespond}
      <div
        class="dark:from-primary-950/30 dark:to-secondary-950/30 card border-2 border-primary-500/20 bg-gradient-to-br from-primary-50 to-secondary-50 p-6"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div>
              <h3 class="h4 font-semibold text-primary-700 dark:text-primary-300">
                Interested in this request?
              </h3>
              <p class="text-sm text-surface-600 dark:text-surface-400">
                Let them know how you can help!
              </p>
            </div>
          </div>
          <!-- Create Exchange Proposal -->
          <button class="variant-filled-primary btn" onclick={handleCreateProposal}>
            <span>🔄 Create Exchange Proposal</span>
          </button>
        </div>
      </div>
    {:else if currentUser && !isUserApproved(currentUser)}
      <!-- User needs approval -->
      <div class="card variant-soft-warning p-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined">info</span>
          <p class="text-sm">
            Your account is pending approval before you can respond to requests.
          </p>
        </div>
      </div>
    {/if}

    <!-- View Proposals (for request owner) -->
    {#if request?.creator?.toString() === currentUser?.original_action_hash?.toString()}
      <div class="card p-6">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="h4 font-semibold">Proposals for Your Request</h3>
            <p class="text-sm text-surface-600 dark:text-surface-400">
              People who want to help with your request
            </p>
          </div>
          <a href="/exchanges" class="variant-filled-secondary btn">
            <span>View My Proposals</span>
          </a>
        </div>

        <div class="py-4 text-center text-surface-500">
          <span class="material-symbols-outlined mb-2 text-2xl">arrow_forward</span>
          <p class="text-sm">Go to your exchanges page to view and manage proposals</p>
        </div>
      </div>
    {/if}

    <!-- Metadata -->
    <div class="card p-6">
      <h3 class="h4 mb-4 font-semibold">Metadata</h3>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h4 class="mb-1 font-medium">Created</h4>
          <p class="text-surface-600 dark:text-surface-400">{createdAt()}</p>
        </div>
        <div>
          <h4 class="mb-1 font-medium">Last Updated</h4>
          <p class="text-surface-600 dark:text-surface-400">{updatedAt()}</p>
        </div>
      </div>

      <!-- Technical Details (for advanced users) -->
      <details class="card p-6">
        <summary class="h4 cursor-pointer transition-colors hover:text-primary-500">
          Technical Details
        </summary>
        <div class="mt-4 space-y-3 text-sm">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <strong class="text-surface-800 dark:text-surface-200">Original Action Hash:</strong>
              <code
                class="code mt-1 block break-all rounded bg-surface-100 p-2 text-xs dark:bg-surface-800"
              >
                {request.original_action_hash
                  ? encodeHashToBase64(request.original_action_hash)
                  : 'N/A'}
              </code>
            </div>
            <div>
              <strong class="text-surface-800 dark:text-surface-200">Previous Action Hash:</strong>
              <code
                class="code mt-1 block break-all rounded bg-surface-100 p-2 text-xs dark:bg-surface-800"
              >
                {request.previous_action_hash
                  ? encodeHashToBase64(request.previous_action_hash)
                  : 'N/A'}
              </code>
            </div>
          </div>

          {#if request.creator}
            <div>
              <strong class="text-surface-800 dark:text-surface-200">Creator Hash:</strong>
              <code
                class="code mt-1 block break-all rounded bg-surface-100 p-2 text-xs dark:bg-surface-800"
              >
                {request.creator.toString()}
              </code>
            </div>
          {/if}
        </div>
      </details>
    </div>
  {:else}
    <div class="card p-8 text-center">
      <h2 class="h2 mb-4">Request Not Found</h2>
      <p class="mb-4 text-surface-600 dark:text-surface-400">
        The requested request could not be found or may have been removed.
      </p>
      <button class="variant-filled-primary btn" onclick={() => goto('/requests')}>
        Browse All Requests
      </button>
    </div>
  {/if}
</section>
