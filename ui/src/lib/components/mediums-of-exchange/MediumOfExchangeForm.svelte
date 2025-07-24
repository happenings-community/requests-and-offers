<script lang="ts">
  import type {
    UIMediumOfExchange,
    MediumOfExchangeInDHT
  } from '$lib/schemas/mediums-of-exchange.schemas';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { shouldShowMockButtons } from '$lib/services/devFeatures.service';
  import { createMockedMediumOfExchange, createSuggestedMockedMediumOfExchange } from '$lib/utils/mocks';

  type Props = {
    mediumOfExchange?: UIMediumOfExchange | null;
    mode?: 'create' | 'suggest' | 'edit';
    onSubmitSuccess?: (result: UIMediumOfExchange) => void;
    onCancel?: () => void;
  };

  let {
    mediumOfExchange = null,
    mode = 'create',
    onSubmitSuccess = (_result: UIMediumOfExchange) => {},
    onCancel = () => {}
  }: Props = $props();

  // Simple form state management (bypassing composable for now)
  let code = $state(mediumOfExchange?.code ?? '');
  let name = $state(mediumOfExchange?.name ?? '');
  let isSubmitting = $state(false);
  let errors = $state({} as Record<string, string>);

  const isValid = $derived(
    code.trim() !== '' && name.trim() !== '' && Object.keys(errors).length === 0
  );

  async function handleSubmit(event: Event) {
    event.preventDefault();
    isSubmitting = true;
    errors = {};

    try {
      const input: MediumOfExchangeInDHT = {
        code: code.trim(),
        name: name.trim()
      };

      let result: UIMediumOfExchange;

      if (mode === 'edit') {
        if (!mediumOfExchange?.actionHash || !mediumOfExchange?.original_action_hash) {
          throw new Error('Medium of exchange data is missing for update.');
        }

        console.log('Update params:', {
          originalActionHash: mediumOfExchange.original_action_hash,
          previousActionHash: mediumOfExchange.actionHash,
          input
        });

        const record = await runEffect(
          mediumsOfExchangeStore.updateMediumOfExchange(
            mediumOfExchange.original_action_hash, // The original action hash from when it was first created
            mediumOfExchange.actionHash, // The current action hash (previous version)
            input
          )
        );

        console.log('Update record result:', record);

        // Use the original action hash to get the latest version
        const updatedMoE = await runEffect(
          mediumsOfExchangeStore.getLatestMediumOfExchangeRecord(
            mediumOfExchange.original_action_hash
          )
        );
        if (!updatedMoE) throw new Error('Could not retrieve updated medium of exchange.');
        result = updatedMoE;
      } else {
        const record = await runEffect(mediumsOfExchangeStore.suggestMediumOfExchange(input));
        const newMoE = await runEffect(
          mediumsOfExchangeStore.getMediumOfExchange(record.signed_action.hashed.hash)
        );
        if (!newMoE) throw new Error('Could not retrieve created medium of exchange.');
        result = newMoE;
      }

      onSubmitSuccess(result);
    } catch (err) {
      console.error(`Failed to ${mode} medium of exchange:`, err);
      errors.form = err instanceof Error ? err.message : 'An unknown error occurred.';
    } finally {
      isSubmitting = false;
    }
  }

  /**
   * Creates a mocked medium of exchange with realistic data
   */
  async function handleMockSubmit(event: Event) {
    event.preventDefault();
    isSubmitting = true;
    errors = {};

    try {
      const mockedMedium = mode === 'suggest' 
        ? createSuggestedMockedMediumOfExchange()
        : createMockedMediumOfExchange();
      
      // Update form state with mocked data
      code = mockedMedium.code;
      name = mockedMedium.name;
      
      // Submit the mocked data
      const record = await runEffect(
        mediumsOfExchangeStore.suggestMediumOfExchange(mockedMedium)
      );

      // Convert record to UIMediumOfExchange for callback
      const uiMedium: UIMediumOfExchange = {
        actionHash: record.signed_action.hashed.hash,
        original_action_hash: record.signed_action.hashed.hash,
        code: mockedMedium.code,
        name: mockedMedium.name,
        description: mockedMedium.description,
        resourceSpecHreaId: mockedMedium.resource_spec_hrea_id,
        status: 'pending',
        createdAt: new Date(),
      };

      onSubmitSuccess(uiMedium);
    } catch (err) {
      console.error(`Failed to ${mode} mocked medium of exchange:`, err);
      errors.form = err instanceof Error ? err.message : 'An unknown error occurred.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<form onsubmit={handleSubmit} class="space-y-6">
  <div class="card p-6">
    <header class="card-header">
      <h2 class="h2 text-2xl font-bold">
        {#if mode === 'create'}
          Create New Medium of Exchange
        {:else if mode === 'suggest'}
          Suggest New Medium of Exchange
        {:else}
          Edit Medium of Exchange
        {/if}
      </h2>
      <p class="text-surface-600 dark:text-surface-400">
        {#if mode === 'suggest'}
          Your suggestion will be reviewed by an administrator.
        {:else}
          Fill in the details below to add a new currency or payment method.
        {/if}
      </p>
    </header>

    <section class="p-4">
      <div class="space-y-4">
        <label class="label">
          <span>Currency Code <span class="text-error-500">*</span></span>
          <input
            class="input"
            class:input-error={errors.code}
            placeholder="e.g., USD, EUR, NZD, BTC"
            bind:value={code}
            required
            maxlength="10"
          />
          {#if errors.code}
            <p class="mt-1 text-sm text-error-500">{errors.code}</p>
          {:else}
            <p class="mt-1 text-sm text-surface-500">
              Enter the standard currency code (3-10 characters).
            </p>
          {/if}
        </label>

        <label class="label">
          <span>Display Name <span class="text-error-500">*</span></span>
          <input
            class="input"
            class:input-error={errors.name}
            placeholder="e.g., US Dollar, Euro, Bitcoin"
            bind:value={name}
            required
            maxlength="100"
          />
          {#if errors.name}
            <p class="mt-1 text-sm text-error-500">{errors.name}</p>
          {:else}
            <p class="mt-1 text-sm text-surface-500">
              Enter the full display name for this medium of exchange.
            </p>
          {/if}
        </label>

        {#if errors.form}
          <div class="alert variant-filled-error">
            <div class="alert-message">
              <h3 class="h3">Error</h3>
              <p>{errors.form}</p>
            </div>
          </div>
        {/if}
      </div>
    </section>

    <footer
      class="card-footer flex items-center justify-end gap-2 border-t border-surface-200 p-4 dark:border-surface-700"
    >
      <button
        type="button"
        class="variant-soft btn"
        onclick={() => onCancel()}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      
      {#if (mode === 'create' || mode === 'suggest') && shouldShowMockButtons()}
        <button
          type="button"
          class="variant-soft-secondary btn"
          onclick={handleMockSubmit}
          disabled={isSubmitting}
        >
          {#if isSubmitting}
            <span class="loading loading-spinner loading-sm"></span>
            Submitting...
          {:else}
            Create Mock {mode === 'suggest' ? 'Suggestion' : 'Medium of Exchange'}
          {/if}
        </button>
      {/if}
      
      <button type="submit" class="variant-filled-primary btn" disabled={!isValid || isSubmitting}>
        {#if isSubmitting}
          <span class="loading loading-spinner loading-sm"></span>
          Submitting...
        {:else if mode === 'create'}
          Create Medium of Exchange
        {:else if mode === 'suggest'}
          Suggest Medium of Exchange
        {:else}
          Save Changes
        {/if}
      </button>
    </footer>
  </div>
</form>
