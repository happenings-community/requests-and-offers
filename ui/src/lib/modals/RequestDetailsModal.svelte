<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { UIRequest, UIUser, UIOrganization } from '@/types/ui';
  import { encodeHashToBase64 } from '@holochain/client';
  import { goto } from '$app/navigation';
  import RequestStatusBadge from '@/lib/components/RequestStatusBadge.svelte';
  import RequestSkillsTags from '@/lib/components/RequestSkillsTags.svelte';
  import { formatDate, getUserPictureUrl, getOrganizationLogoUrl } from '@/utils';
  import usersStore from '@/stores/users.store.svelte';
  import organizationsStore from '@/stores/organizations.store.svelte';

  type RequestDetailsModalMeta = {
    request: UIRequest;
    canEdit: boolean;
    canDelete: boolean;
  };

  // Get modal store and meta data
  const modalStore = getModalStore();
  const meta = $derived.by(() => {
    return $modalStore[0]?.meta as RequestDetailsModalMeta;
  });

  // Extract request and permissions from meta
  const request = $derived(meta?.request);
  const canEdit = $derived.by(() => {
    if (!meta?.request || !meta?.request.creator) return false;
    // User can edit if they created the request
    if (
      meta.request.creator &&
      meta.request.creator.toString() === meta.request.original_action_hash?.toString()
    ) {
      return true;
    }
    // TODO: Add organization coordinator check
    return false;
  });
  const canDelete = $derived(meta?.canDelete ?? false);

  // State for creator and organization
  let creator: UIUser | null = $state(null);
  let organization: UIOrganization | null = $state(null);

  // Create URLs for images
  const creatorPictureUrl = $derived.by(() => creator ? getUserPictureUrl(creator) : null);
  const organizationLogoUrl = $derived.by(() => organization ? getOrganizationLogoUrl(organization) : null);

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

  // Handle edit action
  function handleEdit() {
    if (request?.original_action_hash) {
      const requestId = encodeHashToBase64(request.original_action_hash);
      modalStore.close();
      goto(`/requests/${requestId}/edit`);
    }
  }

  // Handle delete action
  function handleDelete() {
    // TODO: Implement delete confirmation and action
    console.log('Delete request', request);
    modalStore.close();
  }

  // Handle view details action
  function handleViewDetails() {
    if (request?.original_action_hash) {
      const requestId = encodeHashToBase64(request.original_action_hash);
      modalStore.close();
      goto(`/requests/${requestId}`);
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

  // Load creator and organization data when request changes
  $effect(() => {
    async function loadData() {
      if (!request) return;

      // Load creator data
      if (request.creator) {
        try {
          creator = await usersStore.getUserByActionHash(request.creator);
        } catch (err) {
          console.error('Failed to load creator:', err);
          creator = null;
        }
      }

      // Load organization data
      if (request.organization) {
        try {
          organization = await organizationsStore.getOrganizationByActionHash(request.organization);
        } catch (err) {
          console.error('Failed to load organization:', err);
          organization = null;
        }
      }
    }

    loadData();
  });
</script>

<!-- Modal with request details -->
<div class="modal-container p-4 bg-surface-100-800-token rounded-container-token">
  <header class="mb-4 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <h2 class="h3 font-semibold">{request?.title || 'Request Details'}</h2>
      {#if request?.process_state}
        <RequestStatusBadge state={request.process_state} showLabel={true} />
      {/if}
    </div>
    <button class="btn-icon variant-ghost-surface" onclick={() => modalStore.close()}>
      <span class="material-symbols-outlined">close</span>
    </button>
  </header>

  <section class="space-y-4">
    <!-- Description -->
    <div>
      <h3 class="h4 font-semibold">Description</h3>
      <p class="whitespace-pre-line">{request?.description || 'No description provided.'}</p>
    </div>

    <!-- Skills -->
    <div>
      <h3 class="h4 font-semibold">Skills Required</h3>
      {#if request?.skills && request.skills.length > 0}
        <RequestSkillsTags skills={request.skills} maxVisible={10} />
      {:else}
        <p class="text-surface-500">No skills specified.</p>
      {/if}
    </div>

    <!-- Creator info -->
    <div>
      <h3 class="h4 font-semibold">Creator</h3>
      <div class="flex items-center gap-2">
        {#if creator}
          <div class="flex items-center gap-3">
            <div class="avatar w-12 h-12 rounded-full overflow-hidden">
              {#if creatorPictureUrl && creatorPictureUrl !== '/default_avatar.webp'}
                <img src={creatorPictureUrl} alt={creator.name} class="w-full h-full object-cover" />
              {:else}
                <div class="bg-primary-500 text-white w-full h-full flex items-center justify-center">
                  <span class="text-lg font-semibold">{creator.name.charAt(0).toUpperCase()}</span>
                </div>
              {/if}
            </div>
            <div>
              <p class="font-semibold">{creator.name}</p>
              {#if creator.nickname}
                <p class="text-sm text-surface-600-300-token">@{creator.nickname}</p>
              {/if}
            </div>
          </div>
        {:else if request?.creator}
          <a 
            href={`/users/${encodeHashToBase64(request.creator)}`} 
            class="text-primary-500 hover:underline"
          >
            View Creator Profile
          </a>
        {:else}
          <span class="text-surface-500 italic">Unknown creator</span>
        {/if}
      </div>
    </div>

    <!-- Organization info (if applicable) -->
    {#if request?.organization}
      <div>
        <h3 class="h4 font-semibold">Organization</h3>
        <div class="flex items-center gap-2">
          {#if organization}
            <div class="flex items-center gap-3">
              <div class="avatar w-12 h-12 rounded-full overflow-hidden">
                {#if organizationLogoUrl && organizationLogoUrl !== '/default_avatar.webp'}
                  <img src={organizationLogoUrl} alt={organization.name} class="w-full h-full object-cover" />
                {:else}
                  <div class="bg-secondary-500 text-white w-full h-full flex items-center justify-center">
                    <span class="text-lg font-semibold">{organization.name.charAt(0).toUpperCase()}</span>
                  </div>
                {/if}
              </div>
              <div>
                <p class="font-semibold">{organization.name}</p>
                {#if organization.description}
                  <p class="text-sm text-surface-600-300-token">{organization.description.substring(0, 50)}...</p>
                {/if}
              </div>
            </div>
          {:else}
            <a 
              href={`/organizations/${encodeHashToBase64(request.organization)}`} 
              class="text-primary-500 hover:underline"
            >
              View Organization
            </a>
          {/if}
        </div>
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
  </section>

  <!-- Action buttons -->
  <footer class="mt-6 flex justify-end gap-2">
    <button class="btn variant-filled-primary" onclick={handleViewDetails}>
      View Full Details
    </button>

    {#if canEdit}
      <button class="btn variant-filled-secondary" onclick={handleEdit}> Edit </button>
    {/if}

    {#if canDelete}
      <button class="btn variant-filled-error" onclick={handleDelete}> Delete </button>
    {/if}
  </footer>
</div>
