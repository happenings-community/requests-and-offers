<script lang="ts">
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import organizationsStore from '$lib/stores/organizations.store.svelte';
  import RequestForm from '$lib/components/requests/RequestForm.svelte';
  import ServiceTypesGuard from '$lib/components/service-types/ServiceTypesGuard.svelte';
  import type { RequestInput } from '$lib/types/holochain';
  import type { UIOrganization } from '$lib/types/ui';
  import { runEffect } from '$lib/utils/effect';
  import { useRequestDetails } from '$lib/composables';

  // Initialize the composable with edit-specific behavior
  const requestDetails = useRequestDetails({
    backRoute: '/requests'
  });

  // Destructure for template convenience
  const { isLoading, error, request, canEdit, navigateBack, requestId, refreshData } =
    requestDetails;

  // Toast store for notifications
  const toastStore = getToastStore();

  // Current user and coordinated organizations
  const { currentUser } = $derived(usersStore);
  let userCoordinatedOrganizations: UIOrganization[] = $state([]);

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
      navigateBack();
    } catch (err) {
      console.error('Failed to update request:', err);
      toastStore.trigger({
        message: `Failed to update request: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }

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
        const coordinatedOrgs = await organizationsStore.getUserCoordinatedOrganizations(
          user.original_action_hash!
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

  function handleCancel() {
    if (requestId) {
      goto(`/requests/${requestId}`);
    } else {
      navigateBack();
    }
  }
</script>

<ServiceTypesGuard
  title="Service Types Required for Requests"
  description="Requests must be categorized with service types. Administrators need to create service types before users can edit requests."
>
  <section class="container mx-auto p-4">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="h1">Edit Request</h1>
      <div class="flex gap-2">
        <button class="btn variant-soft" onclick={handleCancel}>Cancel</button>
        <button class="btn variant-soft" onclick={navigateBack}>Back to Requests</button>
      </div>
    </div>

    {#if error}
      <div class="alert variant-filled-error mb-4">
        <div class="alert-message">
          <h3 class="h3">Error</h3>
          <p>{error}</p>
        </div>
        <div class="alert-actions">
          <button class="btn btn-sm" onclick={refreshData}>Try Again</button>
          <button class="btn btn-sm" onclick={navigateBack}>Back to Requests</button>
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
          <button class="btn btn-sm" onclick={navigateBack}>Back to Requests</button>
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
      <div class="text-surface-500 text-center text-xl">Request not found.</div>
    {/if}
  </section>
</ServiceTypesGuard>
