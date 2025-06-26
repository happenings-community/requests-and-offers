<script lang="ts">
  import ServiceTypeForm from '$lib/components/service-types/ServiceTypeForm.svelte';
  import type { ServiceTypeInDHT } from '$lib/types/holochain';
  import { useServiceTypeDetails } from '$lib/composables';
  import { runEffect } from '$lib/utils/effect';
  import { showToast } from '$lib/utils';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';

  // Initialize the composable with edit-specific behavior
  const serviceTypeDetails = useServiceTypeDetails({
    backRoute: '/admin/service-types',
    onDeleted: () => {
      // Already handled by the composable's navigation
    }
  });

  // Destructure for template convenience
  const { isLoading, error, serviceType, navigateBack, refreshData } = serviceTypeDetails;

  // Handle form submission
  async function handleUpdateServiceType(updatedServiceType: ServiceTypeInDHT) {
    if (!serviceType?.original_action_hash || !serviceType?.previous_action_hash) {
      await runEffect(showToast('Cannot update service type: missing action hashes', 'error'));
      return;
    }

    try {
      await runEffect(
        serviceTypesStore.updateServiceType(
          serviceType.original_action_hash,
          serviceType.previous_action_hash,
          updatedServiceType
        )
      );

      await runEffect(showToast('Service type updated successfully'));
      navigateBack();
    } catch (err) {
      console.error('Failed to update service type:', err);
      await runEffect(
        showToast(
          `Failed to update service type: ${err instanceof Error ? err.message : String(err)}`,
          'error'
        )
      );
    }
  }
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="h1">Edit Service Type</h1>
    <button class="btn variant-soft" onclick={navigateBack}> Back to Service Types </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={refreshData}>Try Again</button>
        <button class="btn btn-sm" onclick={navigateBack}>Back to Service Types</button>
      </div>
    </div>
  {:else if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading service type...</p>
    </div>
  {:else if serviceType}
    <div class="card p-6">
      <header class="card-header">
        <h2 class="h2">Edit Service Type</h2>
        <p class="text-surface-600">
          Modify the service type details. Changes will affect all requests and offers using this
          service type.
        </p>
      </header>

      <section class="p-4">
        <ServiceTypeForm
          mode="edit"
          {serviceType}
          onSubmit={handleUpdateServiceType}
          onCancel={navigateBack}
        />
      </section>
    </div>
  {:else}
    <div class="text-surface-500 text-center text-xl">Service type not found.</div>
  {/if}
</section>
