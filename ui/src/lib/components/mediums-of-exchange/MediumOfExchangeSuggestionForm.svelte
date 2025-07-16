<script lang="ts">
  import { getToastStore } from '@skeletonlabs/skeleton';
  import type { MediumOfExchangeInDHT } from '$lib/schemas/mediums-of-exchange.schemas';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { runEffect } from '$lib/utils/effect';

  type Props = {
    onSubmitSuccess?: () => void;
    onCancel?: () => void;
  };

  const { onSubmitSuccess = () => {}, onCancel = () => {} }: Props = $props();

  // Toast store for notifications
  const toastStore = getToastStore();

  // Form state
  let code = $state('');
  let name = $state('');
  let description = $state('');
  let submitting = $state(false);
  let errors = $state<{ code?: string; name?: string; description?: string; general?: string }>({});

  // Form validation
  const isValid = $derived(code.trim().length > 0 && name.trim().length > 0 && !submitting);

  function validateForm(): boolean {
    errors = {};

    if (!code.trim()) {
      errors.code = 'Code is required';
    } else if (code.trim().length < 2) {
      errors.code = 'Code must be at least 2 characters';
    } else if (code.trim().length > 10) {
      errors.code = 'Code must be no more than 10 characters';
    }

    if (!name.trim()) {
      errors.name = 'Name is required';
    } else if (name.trim().length < 3) {
      errors.name = 'Name must be at least 3 characters';
    } else if (name.trim().length > 100) {
      errors.name = 'Name must be no more than 100 characters';
    }

    if (description.trim() && description.trim().length > 500) {
      errors.description = 'Description must be no more than 500 characters';
    }

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    submitting = true;
    errors = {};

    try {
      const mediumOfExchange: MediumOfExchangeInDHT = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || null
      };

      await runEffect(mediumsOfExchangeStore.suggestMediumOfExchange(mediumOfExchange));

      toastStore.trigger({
        message: 'Medium of exchange suggestion submitted successfully!',
        background: 'variant-filled-success'
      });

      // Reset form
      code = '';
      name = '';
      description = '';

      onSubmitSuccess();
    } catch (err) {
      console.error('Failed to suggest medium of exchange:', err);
      errors.general = 'Failed to submit suggestion. Please try again.';

      toastStore.trigger({
        message: 'Failed to submit suggestion',
        background: 'variant-filled-error'
      });
    } finally {
      submitting = false;
    }
  }

  function suggestMockedMedium() {
    const mockMediums = [
      { code: 'BTC', name: 'Bitcoin' },
      { code: 'ETH', name: 'Ethereum' },
      { code: 'USD', name: 'US Dollar' },
      { code: 'EUR', name: 'Euro' },
      { code: 'CAD', name: 'Canadian Dollar' },
      { code: 'GBP', name: 'British Pound' },
      { code: 'JPY', name: 'Japanese Yen' },
      { code: 'CHF', name: 'Swiss Franc' },
      { code: 'AUD', name: 'Australian Dollar' },
      { code: 'NZD', name: 'New Zealand Dollar' }
    ];

    const randomMedium = mockMediums[Math.floor(Math.random() * mockMediums.length)];

    code = randomMedium.code;
    name = randomMedium.name;
  }
</script>

<div class="card space-y-4 p-4">
  <header class="card-header">
    <h3 class="h3">Suggest a New Medium of Exchange</h3>
    <p class="text-surface-600 dark:text-surface-400">
      Have an idea for a new currency or medium of exchange? Suggest it here. An administrator will
      review it.
    </p>
  </header>

  <section class="p-4">
    <form onsubmit={handleSubmit} class="space-y-4">
      <!-- Code Field -->
      <label class="label">
        <span>Code <span class="text-error-500">*</span></span>
        <input
          type="text"
          class="input"
          class:input-error={errors.code}
          placeholder="e.g., USD, BTC, EUR"
          bind:value={code}
          required
          maxlength="10"
          disabled={submitting}
        />
        {#if errors.code}
          <p class="mt-1 text-sm text-error-500">{errors.code}</p>
        {:else}
          <p class="mt-1 text-sm text-surface-500">Short code for the currency (2-10 characters)</p>
        {/if}
      </label>

      <!-- Name Field -->
      <label class="label">
        <span>Name <span class="text-error-500">*</span></span>
        <input
          type="text"
          class="input"
          class:input-error={errors.name}
          placeholder="e.g., US Dollar, Bitcoin, Euro"
          bind:value={name}
          required
          maxlength="100"
          disabled={submitting}
        />
        {#if errors.name}
          <p class="mt-1 text-sm text-error-500">{errors.name}</p>
        {:else}
          <p class="mt-1 text-sm text-surface-500">Full name of the currency (3-100 characters)</p>
        {/if}
      </label>

      <!-- Description Field -->
      <label class="label">
        <span>Description</span>
        <textarea
          class="textarea"
          class:input-error={errors.description}
          placeholder="Optional description of this medium of exchange..."
          bind:value={description}
          maxlength="500"
          rows="3"
          disabled={submitting}
        ></textarea>
        {#if errors.description}
          <p class="mt-1 text-sm text-error-500">{errors.description}</p>
        {:else}
          <p class="mt-1 text-sm text-surface-500">Optional description (max 500 characters)</p>
        {/if}
      </label>

      <!-- General Error -->
      {#if errors.general}
        <div class="alert variant-filled-error">
          <p>{errors.general}</p>
        </div>
      {/if}

      <!-- Submit buttons -->
      <div class="flex justify-around gap-4">
        <button type="submit" class="variant-filled-primary btn" disabled={!isValid}>
          {#if submitting}
            <span class="loading loading-spinner loading-sm"></span>
            Submitting...
          {:else}
            Suggest Medium
          {/if}
        </button>

        <button
          type="button"
          class="variant-filled-tertiary btn"
          onclick={suggestMockedMedium}
          disabled={submitting}
        >
          Use Mock Data
        </button>

        <button
          type="button"
          class="variant-soft btn"
          onclick={() => onCancel()}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  </section>
</div>
