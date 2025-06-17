<script lang="ts">
  import { goto } from '$app/navigation';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import ServiceTypeForm from '$lib/components/service-types/ServiceTypeForm.svelte';
  import type { ServiceTypeInDHT } from '$lib/types/holochain';
  import { runEffect } from '$lib/utils/effect';
  import { showToast } from '$lib/utils';

  async function handleCreateServiceType(input: ServiceTypeInDHT) {
    try {
      await runEffect(serviceTypesStore.createServiceType(input));
      runEffect(showToast('Service type created successfully'));

      // Navigate back to the service types list
      goto('/admin/service-types');
    } catch (error) {
      runEffect(showToast(`Failed to create service type: ${error}`, 'error'));
    }
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
      <ServiceTypeForm mode="create" onSubmit={handleCreateServiceType} onCancel={handleCancel} />
    </section>
  </div>
</section>
