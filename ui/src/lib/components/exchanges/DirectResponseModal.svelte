<!-- DirectResponseModal.svelte - Modal for creating direct response proposals -->
<script lang="ts">
  import type { CreateExchangeProposalInput } from '$lib/services/zomes/exchanges.service';

  interface Props {
    onSubmit?: (input: CreateExchangeProposalInput) => void;
    onCancel?: () => void;
  }

  const { onSubmit, onCancel }: Props = $props();

  // Form state
  let serviceDetails = $state('');
  let terms = $state('');
  let exchangeMedium = $state('');
  let exchangeValue = $state('');
  let deliveryTimeframe = $state('');
  let notes = $state('');

  const handleSubmit = () => {
    const input: CreateExchangeProposalInput = {
      target_entity_hash: '' as any, // TODO: Get from context
      service_details: serviceDetails,
      terms,
      exchange_medium: exchangeMedium,
      exchange_value: exchangeValue || null,
      delivery_timeframe: deliveryTimeframe || null,
      notes: notes || null
    };

    onSubmit?.(input);
  };

  const isValid = () => {
    return serviceDetails.trim() && terms.trim() && exchangeMedium.trim();
  };
</script>

<div class="card p-6 w-full max-w-2xl">
  <h3 class="h4 font-semibold mb-4">Create Exchange Proposal</h3>
  
  <form class="space-y-4" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
    <label class="block">
      <span class="block text-sm font-medium mb-1">Service Details *</span>
      <textarea
        class="w-full px-3 py-2 border border-surface-300 dark:border-surface-700 rounded-md bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        bind:value={serviceDetails}
        placeholder="Describe what you're offering or requesting..."
        rows="3"
        required
      ></textarea>
    </label>

    <label class="block">
      <span class="block text-sm font-medium mb-1">Terms & Conditions *</span>
      <textarea
        class="w-full px-3 py-2 border border-surface-300 dark:border-surface-700 rounded-md bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        bind:value={terms}
        placeholder="Specify your terms and conditions..."
        rows="3"
        required
      ></textarea>
    </label>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label class="block">
        <span class="block text-sm font-medium mb-1">Exchange Medium *</span>
        <input
          class="w-full px-3 py-2 border border-surface-300 dark:border-surface-700 rounded-md bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          type="text"
          bind:value={exchangeMedium}
          placeholder="e.g., Hours, USD, CAD, Points"
          required
        />
      </label>

      <label class="block">
        <span class="block text-sm font-medium mb-1">Exchange Value</span>
        <input
          class="w-full px-3 py-2 border border-surface-300 dark:border-surface-700 rounded-md bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          type="text"
          bind:value={exchangeValue}
          placeholder="e.g., 10, 50.00, Variable"
        />
      </label>
    </div>

    <label class="block">
      <span class="block text-sm font-medium mb-1">Delivery Timeframe</span>
      <input
        class="w-full px-3 py-2 border border-surface-300 dark:border-surface-700 rounded-md bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        type="text"
        bind:value={deliveryTimeframe}
        placeholder="e.g., Within 1 week, 2-3 business days"
      />
    </label>

    <label class="block">
      <span class="block text-sm font-medium mb-1">Additional Notes</span>
      <textarea
        class="w-full px-3 py-2 border border-surface-300 dark:border-surface-700 rounded-md bg-surface-50 dark:bg-surface-800 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        bind:value={notes}
        placeholder="Any additional information..."
        rows="2"
      ></textarea>
    </label>

    <div class="flex gap-3 justify-end">
      <button
        type="button"
        class="btn variant-soft-surface"
        onclick={onCancel}
      >
        Cancel
      </button>
      <button
        type="submit"
        class="btn variant-filled-primary"
        class:opacity-50={!isValid()}
        class:cursor-not-allowed={!isValid()}
        disabled={!isValid()}
      >
        Create Proposal
      </button>
    </div>
  </form>
</div>

