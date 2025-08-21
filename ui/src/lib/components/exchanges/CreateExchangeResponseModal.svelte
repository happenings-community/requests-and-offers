<script lang="ts">
  import { getToastStore, getModalStore } from '@skeletonlabs/skeleton';
  import { createExchangesStore } from '$lib/stores/exchanges.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { ActionHash } from '@holochain/client';
  import { goto } from '$app/navigation';
  import { createMockedExchangeResponse } from '$lib/utils/mocks';
  import { shouldShowMockButtons } from '$lib/services/devFeatures.service';

  // Props from modal store
  const modalStore = getModalStore();
  const toastStore = getToastStore();
  const exchangesStore = createExchangesStore();

  // Get props from modal meta
  const {
    targetEntityHash,
    entityType,
    entityTitle,
    onSuccess
  }: {
    targetEntityHash: ActionHash;
    entityType: 'request' | 'offer';
    entityTitle: string;
    onSuccess?: () => void;
  } = $modalStore[0].meta;

  // Form state
  let formData = $state({
    service_details: '',
    terms: '',
    exchange_medium: '',
    exchange_value: '',
    delivery_timeframe: '',
    notes: ''
  });

  let isLoading = $state(false);
  let formErrors = $state<Record<string, string>>({});

  // Validation
  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!formData.service_details.trim()) {
      errors.service_details = 'Service details are required';
    }

    if (!formData.terms.trim()) {
      errors.terms = 'Terms are required';
    }

    if (!formData.exchange_medium.trim()) {
      errors.exchange_medium = 'Exchange medium is required';
    }

    formErrors = errors;
    return Object.keys(errors).length === 0;
  }

  // Submit handler
  async function handleSubmit() {
    if (!validateForm()) {
      return;
    }

    isLoading = true;
    try {
      const responseInput = {
        target_entity_hash: targetEntityHash,
        service_details: formData.service_details.trim(),
        terms: formData.terms.trim(),
        exchange_medium: formData.exchange_medium.trim(),
        exchange_value: formData.exchange_value.trim() || null,
        delivery_timeframe: formData.delivery_timeframe.trim() || null,
        notes: formData.notes.trim() || null
      };

      await runEffect(exchangesStore.createResponse(responseInput));

      toastStore.trigger({
        message: 'Exchange response created successfully!',
        background: 'variant-filled-success'
      });

      // Refresh exchanges data
      await runEffect(exchangesStore.fetchResponses());

      modalStore.close();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Navigate to exchanges page
      goto('/exchanges');
    } catch (error) {
      console.error('Failed to create response:', error);
      toastStore.trigger({
        message: `Failed to create response: ${error instanceof Error ? error.message : String(error)}`,
        background: 'variant-filled-error'
      });
    } finally {
      isLoading = false;
    }
  }

  function handleCancel() {
    modalStore.close();
  }

  // Mock response function
  function mockResponse() {
    const mockedData = createMockedExchangeResponse(entityType);
    
    // Fill the form with mocked data
    formData = {
      service_details: mockedData.service_details,
      terms: mockedData.terms,
      exchange_medium: mockedData.exchange_medium,
      exchange_value: mockedData.exchange_value || '',
      delivery_timeframe: mockedData.delivery_timeframe || '',
      notes: mockedData.notes || ''
    };
    
    // Clear any existing form errors
    formErrors = {};
    
    toastStore.trigger({
      message: 'Form filled with mocked response data',
      background: 'variant-filled-info'
    });
  }
</script>

<article class="hcron-modal max-w-2xl">
  <header class="mb-6">
    <h2 class="h2 font-bold">Create Exchange Response</h2>
    <p class="mt-2 text-surface-200">
      Responding to {#if entityType === 'request'}a Request{:else}an Offer{/if} for:
      <strong>{entityTitle}</strong>
    </p>
  </header>

  <div class="max-h-96 space-y-4 overflow-y-auto">
    <!-- Service Details -->
    <label class="label">
      <span class="font-medium">Service Details <span class="text-error-500">*</span></span>
      <textarea
        bind:value={formData.service_details}
        class="textarea text-surface-600"
        rows="3"
        placeholder={entityType === 'request'
          ? "Describe the service you're offering to fulfill this request..."
          : "Describe how you'd like to receive/use this offered service..."}
        class:border-error-500={formErrors.service_details}
        class:focus:ring-error-500={formErrors.service_details}
        disabled={isLoading}
      ></textarea>
      {#if formErrors.service_details}
        <span class="mt-1 text-sm text-error-500">{formErrors.service_details}</span>
      {/if}
    </label>

    <!-- Terms -->
    <label class="label">
      <span class="font-medium">Terms and Conditions <span class="text-error-500">*</span></span>
      <textarea
        bind:value={formData.terms}
        class="textarea text-surface-600"
        rows="3"
        placeholder="Specify your terms, availability, requirements..."
        class:border-error-500={formErrors.terms}
        class:focus:ring-error-500={formErrors.terms}
        disabled={isLoading}
      ></textarea>
      {#if formErrors.terms}
        <span class="mt-1 text-sm text-error-500">{formErrors.terms}</span>
      {/if}
    </label>

    <!-- Exchange Medium -->
    <label class="label">
      <span class="font-medium">Exchange Medium <span class="text-error-500">*</span></span>
      <input
        type="text"
        bind:value={formData.exchange_medium}
        class="input text-surface-600"
        placeholder="e.g., USD, CAD, Hours, Favor, Barter..."
        class:border-error-500={formErrors.exchange_medium}
        class:focus:ring-error-500={formErrors.exchange_medium}
        disabled={isLoading}
      />
      {#if formErrors.exchange_medium}
        <span class="mt-1 text-sm text-error-500">{formErrors.exchange_medium}</span>
      {/if}
    </label>

    <!-- Exchange Value (Optional) -->
    <label class="label">
      <span class="font-medium">Exchange Value</span>
      <input
        type="text"
        bind:value={formData.exchange_value}
        class="input text-surface-600"
        placeholder="e.g., $50, 2 hours, negotiable..."
        disabled={isLoading}
      />
    </label>

    <!-- Delivery Timeframe (Optional) -->
    <label class="label">
      <span class="font-medium">Delivery Timeframe</span>
      <input
        type="text"
        bind:value={formData.delivery_timeframe}
        class="input text-surface-600"
        placeholder="e.g., within 1 week, flexible, ASAP..."
        disabled={isLoading}
      />
    </label>

    <!-- Notes (Optional) -->
    <label class="label">
      <span class="font-medium">Additional Notes</span>
      <textarea
        bind:value={formData.notes}
        class="textarea text-surface-600"
        rows="2"
        placeholder="Any additional information or clarifications..."
        disabled={isLoading}
      ></textarea>
    </label>
  </div>

  <!-- Footer -->
  <footer class="mt-6 flex justify-between">
    <div>
      {#if shouldShowMockButtons()}
        <button 
          type="button"
          class="variant-filled-tertiary btn"
          onclick={mockResponse}
          disabled={isLoading}
          title="Fill form with mocked response data"
        >
          <i class="fas fa-magic mr-2"></i>
          Fill Mock Data
        </button>
      {/if}
    </div>
    <div class="flex gap-3">
      <button class="variant-ghost btn" onclick={handleCancel} disabled={isLoading}> Cancel </button>
      <button class="variant-filled-primary btn" onclick={handleSubmit} disabled={isLoading}>
        {#if isLoading}
          <i class="fas fa-spinner fa-spin mr-2"></i>
          Creating...
        {:else}
          Create Response
        {/if}
      </button>
    </div>
  </footer>
</article>
