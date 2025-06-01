<script lang="ts">
  import { goto } from '$app/navigation';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import ServiceTypeForm from '$lib/components/service-types/ServiceTypeForm.svelte';
  import type { ServiceTypeInDHT } from '$lib/types/holochain';
  import { runEffect } from '$lib/utils/effect';

  const toastStore = getToastStore();

  async function handleCreateServiceType(input: ServiceTypeInDHT) {
    try {
      await runEffect(serviceTypesStore.createServiceType(input));
      toastStore.trigger({
        message: 'Service type created successfully',
        background: 'variant-filled-success'
      });
      
      // Navigate back to the service types list
      goto('/admin/service-types');
    } catch (error) {
      toastStore.trigger({
        message: `Failed to create service type: ${error}`,
        background: 'variant-filled-error'
      });
    }
  }

  function handleCancel() {
    goto('/admin/service-types');
  }
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="h1">Create Service Type</h1>
    <button class="btn variant-soft" onclick={handleCancel}>
      Back to Service Types
    </button>
  </div>

  <div class="card p-6">
    <header class="card-header">
      <h2 class="h2">New Service Type</h2>
      <p class="text-surface-600">
        Create a new service type to categorize requests and offers in the system.
      </p>
    </header>
    
    <section class="p-4">
      <ServiceTypeForm
        mode="create"
        onSubmit={handleCreateServiceType}
        onCancel={handleCancel}
      />
    </section>
  </div>
</section> 