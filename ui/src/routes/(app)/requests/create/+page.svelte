<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import usersStore from '$lib/stores/users.store.svelte';
  import RequestForm from '$lib/components/requests/RequestForm.svelte';
  import ServiceTypesGuard from '@/lib/components/service-types/ServiceTypesGuard.svelte';
  import { useRequestFormManagement } from '$lib/composables/domain/useRequestFormManagement.svelte';
  import { decodeHashFromBase64, type ActionHash } from '@holochain/client';
  import type { UIRequest } from '$lib/types/ui';
  import type { RequestInput } from '$lib/types/holochain';

  // Derived values
  const { currentUser } = $derived(usersStore);

  // Check if there's an organization parameter in the URL
  const organizationId = $derived(page.url.searchParams.get('organization'));

  // Initialize the request form management composable
  const requestManagement = useRequestFormManagement({
    onSubmitSuccess: (request: UIRequest) => {
      // Navigate to the requests list after successful creation
      goto('/requests');
    },
    autoLoadOrganizations: true
  });

  // Wrapper function to match RequestForm's expected onSubmit signature
  async function handleSubmit(request: RequestInput, organizationHash?: ActionHash): Promise<void> {
    // Update the composable's form state with the request data
    requestManagement.setTitle(request.title);
    requestManagement.setDescription(request.description);
    requestManagement.setServiceTypeHashes(request.service_type_hashes);
    requestManagement.setContactPreference(request.contact_preference);
    requestManagement.setExchangePreference(request.exchange_preference);
    requestManagement.setInteractionType(request.interaction_type);
    requestManagement.setLinks(request.links);

    if (organizationHash) {
      requestManagement.setSelectedOrganization(organizationHash);
    }

    // Submit the request using the composable
    await requestManagement.submitRequest();
  }

  // Handle URL-based organization preselection
  $effect(() => {
    async function handleOrganizationPreselection() {
      if (organizationId && currentUser?.original_action_hash) {
        try {
          const orgHash = decodeHashFromBase64(organizationId);

          // Check if this organization is in the user's coordinated organizations
          const isUserOrganization = requestManagement.userCoordinatedOrganizations.some(
            (org) => org.original_action_hash?.toString() === orgHash.toString()
          );

          if (isUserOrganization) {
            requestManagement.setSelectedOrganization(orgHash);
          } else {
            console.warn('User is not a coordinator of the specified organization');
          }
        } catch (err) {
          console.error('Failed to preselect organization:', err);
        }
      }
    }

    // Only run after organizations are loaded
    if (
      !requestManagement.isLoadingOrganizations &&
      requestManagement.userCoordinatedOrganizations.length > 0
    ) {
      handleOrganizationPreselection();
    }
  });
</script>

<ServiceTypesGuard
  title="Service Types Required for Requests"
  description="Requests must be categorized with service types. Administrators need to create service types before users can create requests."
>
  <section class="container mx-auto p-4">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="h1">Create Request</h1>
      <button class="btn variant-soft" onclick={() => goto('/requests')}> Back to Requests </button>
    </div>

    {#if requestManagement.organizationsError}
      <div class="alert variant-filled-error mb-4">
        <p>{requestManagement.organizationsError}</p>
      </div>
    {/if}

    {#if requestManagement.submissionError}
      <div class="alert variant-filled-error mb-4">
        <p>{requestManagement.submissionError}</p>
      </div>
    {/if}

    {#if !currentUser}
      <div class="text-surface-500 text-center text-xl">Please log in to create requests.</div>
    {:else if requestManagement.isLoadingOrganizations}
      <div class="flex h-64 items-center justify-center">
        <span class="loading loading-spinner text-primary"></span>
        <p class="ml-4">Loading organizations...</p>
      </div>
    {:else}
      <div class="card variant-soft p-6">
        <RequestForm
          mode="create"
          organizations={requestManagement.userCoordinatedOrganizations}
          onSubmit={handleSubmit}
          preselectedOrganization={requestManagement.selectedOrganizationHash}
        />

        {#if requestManagement.isSubmitting}
          <div class="mt-4 flex items-center justify-center">
            <span class="loading loading-spinner text-primary"></span>
            <p class="ml-4">Creating request...</p>
          </div>
        {/if}
      </div>
    {/if}
  </section>
</ServiceTypesGuard>
