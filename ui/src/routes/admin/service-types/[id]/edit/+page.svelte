<script lang="ts">
  import { pageTitle } from '$lib/utils/document';
  import ServiceTypeForm from '$lib/components/service-types/ServiceTypeForm.svelte';
  import { useServiceTypeDetails } from '$lib/composables';

  // Initialize the composable with edit-specific behavior
  const serviceTypeDetails = useServiceTypeDetails({
    backRoute: '/admin/service-types'
  });

  // Destructure for template convenience
  const { isLoading, error, serviceType, navigateBack, refreshData } = $derived(serviceTypeDetails);

  // ServiceTypeForm saves the edit itself (useServiceTypeFormManagement) and
  // shows its own success toast, then calls this. Saving again here would write
  // a second update from the same previous action and fork the history.
  function handleUpdateServiceType() {
    navigateBack();
  }
</script>

<svelte:head>
  <title>{pageTitle('Edit Service Type', 'Admin')}</title>
</svelte:head>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="h1">Edit Service Type</h1>
    <button class="variant-soft btn" onclick={navigateBack}> Back to Service Types </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h2 class="h3">Error</h2>
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
          onSubmitSuccess={handleUpdateServiceType}
          onCancel={navigateBack}
        />
      </section>
    </div>
  {:else}
    <div class="text-center text-xl text-surface-500">Service type not found.</div>
  {/if}
</section>
