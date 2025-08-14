<script lang="ts">
  // InputChip import removed as tags functionality has been removed
  import { useServiceTypeFormManagement } from '$lib/composables';
  import { shouldShowMockButtons } from '$lib/services/devFeatures.service';
  import { createMockedServiceTypes } from '$lib/utils/mocks';
  import type { UIServiceType } from '$lib/types/ui';

  type Props = {
    serviceType?: UIServiceType | null;
    mode?: 'create' | 'suggest' | 'edit';
    onSubmitSuccess?: (result: UIServiceType) => void;
    onCancel?: () => void;
  };

  let {
    serviceType = null,
    mode = 'create',
    onSubmitSuccess = (_result: UIServiceType) => {},
    onCancel = () => {}
  }: Props = $props();

  const {
    state: formState,
    isValid,
    createServiceType,
    suggestServiceType,
    updateServiceType
  } = useServiceTypeFormManagement(serviceType || undefined, (result) => {
    onSubmitSuccess(result);
  });

  // tags state removed as tags functionality has been removed

  /**
   * Handles form submission
   */
  async function handleSubmit(event: Event) {
    event.preventDefault();
    if (mode === 'create') {
      await createServiceType();
    } else if (mode === 'suggest') {
      await suggestServiceType();
    } else {
      await updateServiceType();
    }
  }

  /**
   * Creates a mocked service type with realistic data
   */
  async function handleMockSubmit(event: Event) {
    event.preventDefault();
    const mockedServiceType = (await createMockedServiceTypes(1))[0];

    // Update form state with mocked data
    formState.name = mockedServiceType.name;
    formState.description = mockedServiceType.description;

    // Submit the mocked data
    if (mode === 'create') {
      await createServiceType();
    } else if (mode === 'suggest') {
      await suggestServiceType();
    }
  }
</script>

<form onsubmit={handleSubmit} class="space-y-6">
  <div class="card p-6">
    <header class="card-header">
      <h2 class="h2 text-2xl font-bold">
        {#if mode === 'create'}
          Create New Service Type
        {:else if mode === 'suggest'}
          Suggest New Service Type
        {:else}
          Edit Service Type
        {/if}
      </h2>
      <p class="text-surface-600 dark:text-surface-400">
        {#if mode === 'suggest'}
          Your suggestion will be reviewed by an administrator.
        {:else}
          Fill in the details below.
        {/if}
      </p>
    </header>

    <section class="p-4">
      <div class="space-y-4">
        <label class="label">
          <span>Name <span class="text-error-500">*</span></span>
          <input
            class="input"
            class:input-error={formState.errors.name}
            placeholder="Enter service type name"
            bind:value={formState.name}
            required
          />
          {#if formState.errors.name}
            <p class="mt-1 text-sm text-error-500">{formState.errors.name}</p>
          {/if}
        </label>

        <label class="label">
          <span class="flex items-center justify-between">
            <span>Description <span class="text-error-500">*</span></span>
            <span class="text-sm text-surface-500"
              >({formState.description.length}/500 characters)</span
            >
          </span>
          <textarea
            class="textarea"
            class:input-error={formState.errors.description}
            placeholder="Describe this service type in detail"
            rows="4"
            bind:value={formState.description}
            required
            maxlength="500"
          ></textarea>
          {#if formState.errors.description}
            <p class="mt-1 text-sm text-error-500">{formState.errors.description}</p>
          {/if}
        </label>

        <label class="flex items-center space-x-3">
          <input
            type="checkbox"
            class="checkbox"
            bind:checked={formState.technical}
          />
          <span class="label-text">
            <span>Technical Service</span>
            <span class="text-sm text-surface-500 block">
              Check if this service requires technical skills or knowledge
            </span>
          </span>
        </label>
      </div>
    </section>

    <footer
      class="card-footer flex items-center justify-end gap-2 border-t border-surface-200 p-4 dark:border-surface-700"
    >
      <button
        type="button"
        class="variant-soft btn"
        onclick={() => onCancel()}
        disabled={formState.isSubmitting}
      >
        Cancel
      </button>

      {#if (mode === 'create' || mode === 'suggest') && shouldShowMockButtons()}
        <button
          type="button"
          class="variant-soft-secondary btn"
          onclick={handleMockSubmit}
          disabled={formState.isSubmitting}
        >
          {#if formState.isSubmitting}
            <span class="loading loading-spinner loading-sm"></span>
            Submitting...
          {:else}
            Create Mock {mode === 'suggest' ? 'Suggestion' : 'Service Type'}
          {/if}
        </button>
      {/if}

      <button
        type="submit"
        class="variant-filled-primary btn"
        disabled={!isValid || formState.isSubmitting}
      >
        {#if formState.isSubmitting}
          <span class="loading loading-spinner loading-sm"></span>
          Submitting...
        {:else if mode === 'create'}
          Create Service Type
        {:else if mode === 'suggest'}
          Suggest Service Type
        {:else}
          Save Changes
        {/if}
      </button>
    </footer>
  </div>
</form>
