<script lang="ts">
  import { page } from '$app/state';
import { goto } from '$app/navigation';
import { decodeHashFromBase64 } from '@holochain/client';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import ServiceTypeForm from '$lib/components/service-types/ServiceTypeForm.svelte';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import type { UIServiceType } from '$lib/types/ui';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils';

// State
let isLoading = $state(true);
let error: string | null = $state(null);
let serviceType: UIServiceType | null = $state(null);

  // Derived values
  const serviceTypeId = $derived(page.params.id);

  // Handle form submission
  async function handleUpdateServiceType(updatedServiceType: ServiceTypeInDHT) {
    if (!serviceType?.original_action_hash || !serviceType?.previous_action_hash) {
      runEffect(showToast('Cannot update service type: missing action hashes', 'error'));
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

      runEffect(showToast('Service type updated successfully'));

      // Navigate back to the service types list
      goto('/admin/service-types');
    } catch (err) {
      console.error('Failed to update service type:', err);
      runEffect(showToast(`Failed to update service type: ${err instanceof Error ? err.message : String(err)}`, 'error'));
    }
  }

  function handleCancel() {
    goto('/admin/service-types');
  }

  // Load service type data on component mount
  $effect(() => {
    async function loadData() {
      try {
        isLoading = true;
        error = null;

        if (!serviceTypeId) {
          error = 'Invalid service type ID';
          return;
        }

        // Decode the service type hash from the URL
        const serviceTypeHash = decodeHashFromBase64(serviceTypeId);

        // Fetch the service type
        const fetchedServiceType = await runEffect(serviceTypesStore.getServiceType(serviceTypeHash));

        if (!fetchedServiceType) {
          error = 'Service type not found';
          return;
        }

        serviceType = fetchedServiceType;
      } catch (err) {
        console.error('Failed to load service type:', err);
        error = err instanceof Error ? err.message : 'Failed to load service type';
      } finally {
        isLoading = false;
      }
    }

    loadData();
  });
</script>

<section class="space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="h1">Edit Service Type</h1>
    <button class="btn variant-soft" onclick={handleCancel}>
      Back to Service Types
    </button>
  </div>

  {#if error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
      <div class="alert-actions">
        <button class="btn btn-sm" onclick={handleCancel}>
          Back to Service Types
        </button>
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
          Modify the service type details. Changes will affect all requests and offers using this service type.
        </p>
      </header>
      
      <section class="p-4">
        <ServiceTypeForm
          mode="edit"
          {serviceType}
          onSubmit={handleUpdateServiceType}
          onCancel={handleCancel}
        />
      </section>
    </div>
  {:else}
    <div class="text-surface-500 text-center text-xl">Service type not found.</div>
  {/if}
</section> 