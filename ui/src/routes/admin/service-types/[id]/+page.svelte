<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { formatDate } from '$lib/utils';
  import type { UIServiceType, UIRequest, UIOffer } from '$lib/types/ui';
  import RequestCard from '$lib/components/requests/RequestCard.svelte';
  import OfferCard from '$lib/components/offers/OfferCard.svelte';
  import ConfirmModal from '$lib/components/shared/dialogs/ConfirmModal.svelte';
  import type { ConfirmModalMeta } from '$lib/types/ui';

  // Local state
  let isLoading = $state(true);
  let error: string | null = $state(null);
  let serviceType: UIServiceType | null = $state(null);
  let relatedRequests: UIRequest[] = $state([]);
  let relatedOffers: UIOffer[] = $state([]);
  let loadingRelatedContent = $state(false);

  const serviceTypeId = $derived(page.params.id);

  // Formatted display values
  const createdAt = $derived.by(() => {
    if (!serviceType?.created_at) return 'Unknown';
    try {
      return formatDate(new Date(serviceType.created_at));
    } catch (err) {
      console.error('Error formatting created date:', err);
      return 'Invalid date';
    }
  });

  const updatedAt = $derived.by(() => {
    if (!serviceType?.updated_at) return 'N/A';
    try {
      return formatDate(new Date(serviceType.updated_at));
    } catch (err) {
      console.error('Error formatting updated date:', err);
      return 'Invalid date';
    }
  });

  const statusColor = $derived.by(() => {
    if (!serviceType) return 'variant-soft-surface';
    switch (serviceType.status) {
      case 'approved':
        return 'variant-soft-success';
      case 'pending':
        return 'variant-soft-warning';
      case 'rejected':
        return 'variant-soft-error';
      default:
        return 'variant-soft-surface';
    }
  });

  const statusLabel = $derived.by(() => {
    if (!serviceType) return 'Unknown';
    switch (serviceType.status) {
      case 'approved':
        return 'Approved';
      case 'pending':
        return 'Pending Review';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Unknown';
    }
  });

  // Load service type data
  $effect(() => {
    async function loadServiceType() {
      try {
        isLoading = true;
        error = null;

        if (!serviceTypeId) {
          error = 'Invalid service type ID';
          return;
        }

        const hash = decodeHashFromBase64(serviceTypeId);
        const result = await runEffect(serviceTypesStore.getServiceType(hash));

        if (!result) {
          error = 'Service type not found';
          return;
        }

        serviceType = result;

        // Load related requests and offers (for all statuses in admin)
        await loadRelatedContent(hash);
      } catch (err) {
        console.error('Failed to load service type:', err);
        error = err instanceof Error ? err.message : String(err);
      } finally {
        isLoading = false;
      }
    }

    loadServiceType();
  });

  // Load related requests and offers that use this service type
  async function loadRelatedContent(serviceTypeHash: ActionHash) {
    try {
      loadingRelatedContent = true;

      // Get all requests and offers, then filter by service type
      const [allRequests, allOffers] = await Promise.all([
        runEffect(requestsStore.getAllRequests()),
        runEffect(offersStore.getAllOffers())
      ]);

      // Filter requests and offers that include this service type
      const serviceTypeHashString = serviceTypeHash.toString();

      relatedRequests = allRequests.filter((request) =>
        request.service_type_hashes?.some((hash) => hash.toString() === serviceTypeHashString)
      );

      relatedOffers = allOffers.filter((offer) =>
        offer.service_type_hashes?.some((hash) => hash.toString() === serviceTypeHashString)
      );
    } catch (err) {
      console.warn('Failed to load related content:', err);
      // Don't set error for related content - it's not critical
    } finally {
      loadingRelatedContent = false;
    }
  }

  // Navigation functions
  function navigateBack() {
    goto('/admin/service-types');
  }

  function navigateToEdit() {
    if (serviceType?.original_action_hash) {
      const encodedHash = encodeHashToBase64(serviceType.original_action_hash);
      goto(`/admin/service-types/${encodedHash}/edit`);
    }
  }

  async function refreshData() {
    if (serviceTypeId) {
      isLoading = true;
      error = null;
      try {
        const hash = decodeHashFromBase64(serviceTypeId);
        const result = await runEffect(serviceTypesStore.getServiceType(hash));
        if (!result) {
          error = 'Service type not found';
          return;
        }
        serviceType = result;
        await loadRelatedContent(hash);
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      } finally {
        isLoading = false;
      }
    }
  }

  async function deleteServiceType() {
    if (!serviceType?.original_action_hash) {
      error = 'Cannot delete service type: missing action hash';
      return;
    }

    try {
      await runEffect(serviceTypesStore.deleteServiceType(serviceType.original_action_hash));
      navigateBack();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  // Admin status management functions
  async function approveServiceType() {
    if (!serviceType?.original_action_hash) {
      error = 'Cannot approve service type: missing action hash';
      return;
    }

    try {
      await runEffect(serviceTypesStore.approveServiceType(serviceType.original_action_hash));
      await refreshData();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  async function rejectServiceType() {
    if (!serviceType?.original_action_hash) {
      error = 'Cannot reject service type: missing action hash';
      return;
    }

    try {
      await runEffect(serviceTypesStore.rejectServiceType(serviceType.original_action_hash));
      await refreshData();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  // Utility functions
  function handleCopyName() {
    if (serviceType?.name) {
      navigator.clipboard.writeText(serviceType.name);
    }
  }

  function handleCopyHash() {
    if (serviceTypeId) {
      navigator.clipboard.writeText(serviceTypeId);
    }
  }

  // Modal store for confirmations
  const modalStore = getModalStore();
  const confirmModalComponent: ModalComponent = { ref: ConfirmModal };

  // Handle delete with confirmation
  async function handleDelete() {
    const confirmed = await new Promise<boolean>((resolve) => {
      modalStore.trigger({
        type: 'component',
        component: confirmModalComponent,
        meta: {
          message:
            'Are you sure you want to delete this service type?<br/>This action cannot be undone and will affect any related requests or offers.',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel'
        } as ConfirmModalMeta,
        response: (result: boolean) => resolve(result)
      });
    });

    if (confirmed) {
      await deleteServiceType();
    }
  }

  // Handle reject with confirmation
  async function handleReject() {
    const confirmed = await new Promise<boolean>((resolve) => {
      modalStore.trigger({
        type: 'component',
        component: confirmModalComponent,
        meta: {
          message:
            'Are you sure you want to reject this service type?<br/>It will no longer be available for use in requests and offers.',
          confirmLabel: 'Reject',
          cancelLabel: 'Cancel'
        } as ConfirmModalMeta,
        response: (result: boolean) => resolve(result)
      });
    });

    if (confirmed) {
      await rejectServiceType();
    }
  }
</script>

<svelte:head>
  <title>
    {serviceType ? `Admin: ${serviceType.name} Service Type` : 'Admin: Service Type'} - Requests & Offers
  </title>
  <meta
    name="description"
    content={serviceType
      ? `Admin details for ${serviceType.name} service type - ${serviceType.description}`
      : 'Admin service type details'}
  />
</svelte:head>

<section class="container mx-auto space-y-6 p-4">
  <!-- Navigation -->
  <div class="flex items-center justify-between">
    <button class="variant-soft btn" onclick={navigateBack}> ← Back to Admin Service Types </button>

    {#if serviceType}
      <div class="flex gap-2">
        <button
          class="variant-soft-secondary btn btn-sm"
          onclick={handleCopyName}
          title="Copy service type name"
        >
          Copy Name
        </button>
        <button
          class="variant-soft-secondary btn btn-sm"
          onclick={handleCopyHash}
          title="Copy service type hash"
        >
          Copy Hash
        </button>
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
        <button class="variant-filled-primary btn" onclick={refreshData}> Retry </button>
        <button class="variant-soft btn" onclick={navigateBack}>Back to Admin</button>
      </div>
    </div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading service type...</p>
    </div>
  {:else if serviceType}
    <!-- Main Content -->
    <div class="space-y-6">
      <!-- Header Card -->
      <div class="card p-6">
        <div class="card-header">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex-1">
              <div class="mb-2 flex items-center gap-3">
                <h1 class="h1 text-primary-400">{serviceType.name}</h1>
                <span class="chip {statusColor} text-sm">
                  {statusLabel}
                </span>
              </div>
              <p class="mb-4 text-lg text-surface-600 dark:text-surface-400">
                {serviceType.description}
              </p>
            </div>

            <!-- Admin Actions -->
            <div class="flex flex-wrap gap-2">
              {#if serviceType.status === 'pending'}
                <button
                  class="variant-filled-success btn"
                  onclick={approveServiceType}
                  title="Approve this service type"
                >
                  Approve
                </button>
                <button
                  class="variant-filled-error btn"
                  onclick={handleReject}
                  title="Reject this service type"
                >
                  Reject
                </button>
              {:else if serviceType.status === 'rejected'}
                <button
                  class="variant-filled-success btn"
                  onclick={approveServiceType}
                  title="Approve this service type"
                >
                  Approve
                </button>
              {:else if serviceType.status === 'approved'}
                <button
                  class="variant-soft-warning btn"
                  onclick={handleReject}
                  title="Reject this service type"
                >
                  Reject
                </button>
              {/if}

              <button class="variant-soft-primary btn" onclick={navigateToEdit}> Edit </button>
              <button class="variant-soft-error btn" onclick={handleDelete}> Delete </button>
            </div>
          </div>
        </div>

        <!-- Classification Section -->
        <section class="mt-6 border-t border-surface-300 pt-6 dark:border-surface-600">
          <h3 class="h4 mb-3 font-semibold">Classification</h3>
          <div class="flex flex-wrap gap-2">
            <span class="variant-soft-{serviceType.technical ? 'primary' : 'secondary'} badge">
              {serviceType.technical ? 'Technical' : 'Non-Technical'}
            </span>
          </div>
        </section>

        <!-- Metadata Section -->
        <section class="mt-6 border-t border-surface-300 pt-6 dark:border-surface-600">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <h3 class="h4 mb-2 font-semibold">Status</h3>
              <span class="chip {statusColor}">
                {statusLabel}
              </span>
            </div>

            <div>
              <h3 class="h4 mb-2 font-semibold">Created</h3>
              <p class="text-surface-600 dark:text-surface-400">{createdAt}</p>
              {#if serviceType.creator}
                <p class="mt-1 text-xs text-surface-500">
                  by {serviceType.creator.toString().slice(0, 8)}...
                </p>
              {/if}
            </div>

            <div>
              <h3 class="h4 mb-2 font-semibold">Last Updated</h3>
              <p class="text-surface-600 dark:text-surface-400">{updatedAt}</p>
            </div>
          </div>
        </section>
      </div>

      <!-- Usage Statistics -->
      <div class="card p-6">
        <h3 class="h3 mb-4">Usage Statistics</h3>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="card variant-soft p-4">
            <h4 class="h4 mb-2">Related Requests</h4>
            <p class="text-2xl font-bold text-primary-400">
              {loadingRelatedContent ? '...' : relatedRequests.length}
            </p>
            <p class="text-sm text-surface-500">requests using this service type</p>
          </div>
          <div class="card variant-soft p-4">
            <h4 class="h4 mb-2">Related Offers</h4>
            <p class="text-2xl font-bold text-secondary-500">
              {loadingRelatedContent ? '...' : relatedOffers.length}
            </p>
            <p class="text-sm text-surface-500">offers using this service type</p>
          </div>
        </div>
      </div>

      <!-- Related Content -->
      <div class="space-y-6">
        <!-- Related Requests -->
        <div class="card p-6">
          <h3 class="h3 mb-4">
            Related Requests
            {#if !loadingRelatedContent}
              <span class="text-sm text-surface-500">({relatedRequests.length})</span>
            {/if}
          </h3>

          {#if loadingRelatedContent}
            <div class="flex items-center justify-center py-8">
              <span class="loading loading-spinner loading-sm"></span>
              <p class="ml-2">Loading related requests...</p>
            </div>
          {:else if relatedRequests.length === 0}
            <p class="py-4 text-surface-500">No requests are currently using this service type.</p>
          {:else}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each relatedRequests.slice(0, 6) as request}
                <RequestCard {request} />
              {/each}
            </div>

            {#if relatedRequests.length > 6}
              <div class="pt-4 text-center">
                <a
                  href="/admin/requests?service_type={encodeURIComponent(serviceType.name)}"
                  class="variant-soft-primary btn"
                >
                  View All {relatedRequests.length} Requests
                </a>
              </div>
            {/if}
          {/if}
        </div>

        <!-- Related Offers -->
        <div class="card p-6">
          <h3 class="h3 mb-4">
            Related Offers
            {#if !loadingRelatedContent}
              <span class="text-sm text-surface-500">({relatedOffers.length})</span>
            {/if}
          </h3>

          {#if loadingRelatedContent}
            <div class="flex items-center justify-center py-8">
              <span class="loading loading-spinner loading-sm"></span>
              <p class="ml-2">Loading related offers...</p>
            </div>
          {:else if relatedOffers.length === 0}
            <p class="py-4 text-surface-500">No offers are currently using this service type.</p>
          {:else}
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {#each relatedOffers.slice(0, 6) as offer}
                <OfferCard {offer} />
              {/each}
            </div>

            {#if relatedOffers.length > 6}
              <div class="pt-4 text-center">
                <a
                  href="/admin/offers?service_type={encodeURIComponent(serviceType.name)}"
                  class="variant-soft-primary btn"
                >
                  View All {relatedOffers.length} Offers
                </a>
              </div>
            {/if}
          {/if}
        </div>
      </div>

      <!-- Admin Status Information -->
      <div class="card p-6">
        <h3 class="h3 mb-4">Administrative Status</h3>
        <div class="space-y-3 text-surface-600 dark:text-surface-400">
          {#if serviceType.status === 'pending'}
            <div class="alert variant-soft-warning">
              <p class="font-semibold">Pending Review</p>
              <p>
                This service type is awaiting administrative approval. Use the action buttons above
                to approve or reject.
              </p>
            </div>
          {:else if serviceType.status === 'approved'}
            <div class="alert variant-soft-success">
              <p class="font-semibold">Approved</p>
              <p>
                This service type is approved and available for use in requests and offers.
                Currently being used by {relatedRequests.length + relatedOffers.length} items.
              </p>
            </div>
          {:else if serviceType.status === 'rejected'}
            <div class="alert variant-soft-error">
              <p class="font-semibold">Rejected</p>
              <p>
                This service type has been rejected and is not available for public use. It can
                still be used in existing requests/offers but won't appear in selection lists.
              </p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Information Section -->
      <div class="card p-6">
        <h3 class="h3 mb-4">About This Service Type</h3>
        <div class="space-y-3 text-surface-600 dark:text-surface-400">
          <p>
            <strong>{serviceType.name}</strong>
            is a service type category used to organize and categorize requests and offers in the marketplace.
          </p>

          <p>
            <strong>Description:</strong>
            {serviceType.description}
          </p>

          <p>
            <strong>Classification:</strong> This service type is classified as
            {serviceType.technical ? 'technical' : 'non-technical'} to help with categorization and discovery.
          </p>

          <p>
            <strong>Usage:</strong> When users create requests or offers, they can select this service
            type to categorize their content, making it easier for others to find relevant opportunities
            and services.
          </p>

          <p>
            <strong>Impact:</strong> This service type is currently being used by
            <strong>{relatedRequests.length}</strong> request{relatedRequests.length !== 1
              ? 's'
              : ''} and
            <strong>{relatedOffers.length}</strong> offer{relatedOffers.length !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>

      <!-- Technical Details (for debugging/admin purposes) -->
      <details class="card p-6">
        <summary class="h4 cursor-pointer transition-colors hover:text-primary-400">
          Technical Details
        </summary>
        <div class="mt-4 space-y-3 text-sm">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <strong class="text-surface-800 dark:text-surface-200">Original Action Hash:</strong>
              <code
                class="code mt-1 block break-all rounded bg-surface-100 p-2 text-xs dark:bg-surface-800"
              >
                {serviceType.original_action_hash
                  ? encodeHashToBase64(serviceType.original_action_hash)
                  : 'N/A'}
              </code>
            </div>
            <div>
              <strong class="text-surface-800 dark:text-surface-200">Previous Action Hash:</strong>
              <code
                class="code mt-1 block break-all rounded bg-surface-100 p-2 text-xs dark:bg-surface-800"
              >
                {serviceType.previous_action_hash
                  ? encodeHashToBase64(serviceType.previous_action_hash)
                  : 'N/A'}
              </code>
            </div>
          </div>

          {#if serviceType.creator}
            <div>
              <strong class="text-surface-800 dark:text-surface-200">Creator Hash:</strong>
              <code
                class="code mt-1 block break-all rounded bg-surface-100 p-2 text-xs dark:bg-surface-800"
              >
                {serviceType.creator.toString()}
              </code>
            </div>
          {/if}
        </div>
      </details>
    </div>
  {:else}
    <div class="card p-8 text-center">
      <h2 class="h2 mb-4">Service Type Not Found</h2>
      <p class="mb-4 text-surface-600 dark:text-surface-400">
        The requested service type could not be found or may have been removed.
      </p>
      <button class="variant-filled-primary btn" onclick={navigateBack}>
        Back to Admin Service Types
      </button>
    </div>
  {/if}
</section>
