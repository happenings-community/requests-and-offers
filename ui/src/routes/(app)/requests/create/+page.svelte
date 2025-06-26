<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import RequestForm from '$lib/components/requests/RequestForm.svelte';
  import ServiceTypesGuard from '@/lib/components/service-types/ServiceTypesGuard.svelte';
  import { useRequestFormManagement } from '@/lib/composables/domain/requests/useRequestFormManagement.svelte';
  import { decodeHashFromBase64, type ActionHash } from '@holochain/client';

  // Check if there's an organization parameter in the URL
  const organizationId = $derived(page.url.searchParams.get('organization'));

  // Initialize the request form management composable
  const requestManagement = useRequestFormManagement({
    onSubmitSuccess: () => {
      // Navigate to the requests list after successful creation
      goto('/requests', { invalidateAll: true });
    },
    autoLoadOrganizations: true
  });

  // Handle URL-based organization preselection
  $effect(() => {
    async function handleOrganizationPreselection() {
      if (organizationId) {
        try {
          const orgHash = decodeHashFromBase64(organizationId);

          // Find the organization in the loaded list to ensure it's valid
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

    {#if requestManagement.isLoadingOrganizations}
      <div class="flex h-64 items-center justify-center">
        <span class="loading loading-spinner text-primary"></span>
        <p class="ml-4">Loading organizations...</p>
      </div>
    {:else}
      <div class="card variant-soft p-6">
        <RequestForm
          mode="create"
          organizations={requestManagement.userCoordinatedOrganizations}
          state={requestManagement}
          actions={requestManagement}
          onSubmit={requestManagement.submitRequest}
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
