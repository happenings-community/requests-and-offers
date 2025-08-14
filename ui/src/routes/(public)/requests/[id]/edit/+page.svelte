<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import RequestForm from '$lib/components/requests/RequestForm.svelte';
  import PrerequisitesGuard from '$lib/components/common/PrerequisitesGuard.svelte';
  import type { RequestInput } from '$lib/types/holochain';
  import type { UIRequest, UIOrganization } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import { Effect as E } from 'effect';
  import hc from '$lib/services/HolochainClientService.svelte';

  // State
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let request: UIRequest | null = $state(null);
  let userCoordinatedOrganizations: UIOrganization[] = $state([]);

  // Toast store for notifications
  const toastStore = getToastStore();

  // Derived values
  const { currentUser } = $derived(usersStore);
  const requestId = $derived(page.params.id);

  // Check if user can edit the request
  const canEdit = $derived.by(() => {
    if (!currentUser || !request) return false;

    console.log('Permission check:', {
      requestCreator: request.creator?.toString(),
      currentUserHash: currentUser.original_action_hash?.toString(),
      requestAuthorPubKey: (request as any).authorPubKey?.toString(),
      hasCreator: !!request.creator,
      hasCurrentUserHash: !!currentUser.original_action_hash
    });

    // User can edit if they created the request (ActionHash comparison)
    if (request.creator && currentUser.original_action_hash) {
      const result = request.creator.toString() === currentUser.original_action_hash.toString();
      console.log('ActionHash comparison result:', result);
      return result;
    }

    // When request.creator is null/undefined, this likely means the request was created
    // before the user had a profile. In this case, we need alternative logic.
    // For now, we'll be more permissive and allow editing if no creator is set
    // TODO: Implement proper AgentPubKey fallback comparison
    if (!request.creator) {
      console.log('No creator found - allowing edit for backward compatibility');
      return true; // Temporary fallback - allow editing when no creator is set
    }

    // User can edit if they are an organization coordinator
    if (request.organization) {
      return userCoordinatedOrganizations.some(
        (org) => org.original_action_hash?.toString() === request!.organization?.toString()
      );
    }

    return false;
  });

  // Handle form submission
  async function handleSubmit(updatedRequest: RequestInput, organizationHash?: ActionHash) {
    if (!request?.original_action_hash || !request?.previous_action_hash) {
      toastStore.trigger({
        message: 'Invalid request data for update',
        background: 'variant-filled-error'
      });
      return;
    }

    try {
      await runEffect(
        requestsStore.updateRequest(
          request.original_action_hash,
          request.previous_action_hash,
          updatedRequest
        )
      );

      toastStore.trigger({
        message: 'Request updated successfully!',
        background: 'variant-filled-success'
      });

      // Navigate back to the request detail page
      goto(`/requests/${requestId}`);
    } catch (err) {
      console.error('Failed to update request:', err);
      toastStore.trigger({
        message: `Failed to update request: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

  // Initialize request data once on mount
  let hasInitialized = false;

  $effect(() => {
    const currentRequestId = requestId;

    if (!currentRequestId) {
      error = 'Invalid request ID';
      isLoading = false;
      return;
    }

    // Only initialize once per component instance
    if (hasInitialized) {
      return;
    }

    hasInitialized = true;

    async function loadRequestData() {
      isLoading = true;
      error = null;

      console.log('loading request data');

      try {
        // Decode the request hash from the URL
        if (!currentRequestId) {
          throw new Error('Invalid request ID');
        }
        const requestHash = decodeHashFromBase64(currentRequestId);

        // Load the request (this will use cache if available)
        const fetchedRequest = await runEffect(requestsStore.getLatestRequest(requestHash));

        console.log('fetchedRequest', fetchedRequest);

        if (!fetchedRequest) {
          error = 'Request not found';
          request = null;
          isLoading = false;
          return;
        }

        request = fetchedRequest;
        isLoading = false;
      } catch (err) {
        console.error('Failed to load request data:', err);
        error = err instanceof Error ? err.message : 'Failed to load request data';
        request = null;
      } finally {
        isLoading = false;
      }
    }

    loadRequestData();
  });

  // Load user organizations - only once per user
  let lastUserHash: string | null = null;

  $effect(() => {
    const user = currentUser;
    const userHash = user?.original_action_hash?.toString() || null;

    if (!user?.original_action_hash) {
      if (userCoordinatedOrganizations.length > 0) {
        userCoordinatedOrganizations = [];
      }
      lastUserHash = null;
      return;
    }

    // Don't reload for the same user
    if (lastUserHash === userHash) {
      return;
    }

    lastUserHash = userHash;

    async function loadUserOrganizations() {
      if (!user) return;

      try {
        const coordinatedOrgs = await E.runPromise(
          organizationsStore.getUserOrganizations(user.original_action_hash!)
        );

        const acceptedOrgs = coordinatedOrgs.filter(
          (org) => org.status?.status_type === 'accepted'
        );

        userCoordinatedOrganizations = acceptedOrgs;
      } catch (err) {
        console.warn('Failed to load coordinated organizations:', err);
        userCoordinatedOrganizations = [];
      }
    }

    loadUserOrganizations();
  });
</script>

<PrerequisitesGuard
  title="Prerequisites Required for Requests"
  description="Requests require both service types and mediums of exchange. Administrators need to create/approve these before users can edit requests."
>
  <section class="container mx-auto p-4">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="h1">Edit Request</h1>
      <div class="flex gap-2">
        <button class="variant-soft btn" onclick={() => goto(`/requests/${requestId}`)}>
          Cancel
        </button>
        <button class="variant-soft btn" onclick={() => goto('/requests')}>
          Back to Requests
        </button>
      </div>
    </div>

    {#if error}
      <div class="alert variant-filled-error mb-4">
        <div class="alert-message">
          <h3 class="h3">Error</h3>
          <p>{error}</p>
        </div>
        <div class="alert-actions">
          <button class="btn btn-sm" onclick={() => location.reload()}>Try Again</button>
          <button class="btn btn-sm" onclick={() => goto('/requests')}>Back to Requests</button>
        </div>
      </div>
    {:else if isLoading}
      <div class="flex h-64 items-center justify-center">
        <span class="loading loading-spinner text-primary"></span>
        <p class="ml-4">Loading request...</p>
      </div>
    {:else if !canEdit}
      <div class="alert variant-filled-warning mb-4">
        <div class="alert-message">
          <h3 class="h3">Access Denied</h3>
          <p>You don't have permission to edit this request.</p>
        </div>
        <div class="alert-actions">
          <button class="btn btn-sm" onclick={() => goto('/requests')}>Back to Requests</button>
        </div>
      </div>
    {:else if request}
      <div class="card p-6">
        <header class="card-header">
          <h2 class="h2">Edit Request</h2>
          <p class="text-surface-600">
            Modify the request details. Changes will be visible to other users immediately.
          </p>
        </header>

        <section class="p-4">
          <RequestForm
            mode="edit"
            {request}
            organizations={userCoordinatedOrganizations}
            onSubmit={handleSubmit}
          />
        </section>
      </div>
    {:else}
      <div class="text-center text-xl text-surface-500">Request not found.</div>
    {/if}
  </section>
</PrerequisitesGuard>
