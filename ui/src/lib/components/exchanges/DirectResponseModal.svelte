<!-- DirectResponseModal.svelte - Modal for creating direct response proposals -->
<script lang="ts">
  import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
  import { createExchangesStore } from '$lib/stores/exchanges.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { CreateExchangeResponseInput } from '$lib/services/zomes/exchanges.service';
  import type { ActionHash } from '@holochain/client';

  const modalStore = getModalStore();
  const toastStore = getToastStore();
  const exchangesStore = createExchangesStore();

  // Get props from modal meta if available
  const {
    targetEntityHash,
    onSuccess
  }: {
    targetEntityHash?: ActionHash;
    onSuccess?: () => void;
  } = $modalStore[0]?.meta || {};

  // Form state
  let serviceDetails = $state('');
  let terms = $state('');
  let exchangeMedium = $state('');
  let exchangeValue = $state('');
  let deliveryTimeframe = $state('');
  let notes = $state('');
  let isLoading = $state(false);

  const handleSubmit = async () => {
    if (!isValid()) return;

    isLoading = true;
    
    try {
      const input: CreateExchangeResponseInput = {
        target_entity_hash: targetEntityHash || ('' as any), // Will need proper entity hash when implementing
        service_details: serviceDetails,
        terms,
        exchange_medium: exchangeMedium,
        exchange_value: exchangeValue || null,
        delivery_timeframe: deliveryTimeframe || null,
        notes: notes || null
      };

      await runEffect(exchangesStore.createResponse(input));

      toastStore.trigger({
        message: 'Exchange response created successfully!',
        background: 'variant-filled-success'
      });

      modalStore.close();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to create exchange proposal:', error);
      toastStore.trigger({
        message: `Failed to create proposal: ${error instanceof Error ? error.message : String(error)}`,
        background: 'variant-filled-error'
      });
    } finally {
      isLoading = false;
    }
  };

  const handleCancel = () => {
    modalStore.close();
  };

  const isValid = () => {
    return serviceDetails.trim() && terms.trim() && exchangeMedium.trim();
  };
</script>

<div class="card w-full max-w-2xl p-6">
  <h3 class="h4 mb-4 font-semibold">Create Exchange Proposal</h3>

  <form
    class="space-y-4"
    onsubmit={async (e) => {
      e.preventDefault();
      await handleSubmit();
    }}
  >
    <label class="block">
      <span class="mb-1 block text-sm font-medium">Service Details *</span>
      <textarea
        class="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100"
        bind:value={serviceDetails}
        placeholder="Describe what you're offering or requesting..."
        rows="3"
        required
      ></textarea>
    </label>

    <label class="block">
      <span class="mb-1 block text-sm font-medium">Terms & Conditions *</span>
      <textarea
        class="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100"
        bind:value={terms}
        placeholder="Specify your terms and conditions..."
        rows="3"
        required
      ></textarea>
    </label>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-sm font-medium">Exchange Medium *</span>
        <input
          class="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100"
          type="text"
          bind:value={exchangeMedium}
          placeholder="e.g., Hours, USD, CAD, Points"
          required
        />
      </label>

      <label class="block">
        <span class="mb-1 block text-sm font-medium">Exchange Value</span>
        <input
          class="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100"
          type="text"
          bind:value={exchangeValue}
          placeholder="e.g., 10, 50.00, Variable"
        />
      </label>
    </div>

    <label class="block">
      <span class="mb-1 block text-sm font-medium">Delivery Timeframe</span>
      <input
        class="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100"
        type="text"
        bind:value={deliveryTimeframe}
        placeholder="e.g., Within 1 week, 2-3 business days"
      />
    </label>

    <label class="block">
      <span class="mb-1 block text-sm font-medium">Additional Notes</span>
      <textarea
        class="w-full rounded-md border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-100"
        bind:value={notes}
        placeholder="Any additional information..."
        rows="2"
      ></textarea>
    </label>

    <div class="flex justify-end gap-3">
      <button type="button" class="variant-soft-surface btn" onclick={handleCancel} disabled={isLoading}> 
        Cancel 
      </button>
      <button
        type="submit"
        class="variant-filled-primary btn"
        class:opacity-50={!isValid() || isLoading}
        class:cursor-not-allowed={!isValid() || isLoading}
        disabled={!isValid() || isLoading}
      >
        {#if isLoading}
          <span class="animate-spin">⏳</span> Creating...
        {:else}
          Create Proposal
        {/if}
      </button>
    </div>
  </form>
</div>
