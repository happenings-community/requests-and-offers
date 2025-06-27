<script lang="ts">
  import { goto } from '$app/navigation';
  import ServiceTypeForm from '$lib/components/service-types/ServiceTypeForm.svelte';
  import { showToast } from '$lib/utils';
  import type { UIServiceType } from '$lib/types/ui';

  function handleCreateSuccess(newServiceType: UIServiceType) {
    // The newServiceType object is available if needed, but for now we just show a toast and navigate.
    showToast('Service type created successfully', 'success');

    // Navigate back to the service types list
    goto('/admin/service-types');
  }

  function handleCancel() {
    goto('/admin/service-types');
  }
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="h1">Create Service Type</h1>
    <button class="variant-soft btn" onclick={handleCancel}> Back to Service Types </button>
  </div>

  <div class="card p-6">
    <header class="card-header">
      <h2 class="h2">New Service Type</h2>
      <p class="text-surface-600">
        Create a new service type to categorize requests and offers in the system.
      </p>
    </header>

    <section class="p-4">
      <ServiceTypeForm mode="create" onSubmitSuccess={handleCreateSuccess} onCancel={handleCancel} />
    </section>
  </div>
</section>
