<script lang="ts">
  import { InputChip } from '@skeletonlabs/skeleton';
  import { useServiceTypeFormManagement } from '$lib/composables';
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

  let tags = $state(serviceType?.tags ? [...serviceType.tags] : []);

  /**
   * Handles form submission by sanitizing proxy objects before sending to backend.
   * In Svelte 5, rune-based state objects contain Proxy wrappers that can't be
   * serialized for external APIs. We use the spread operator to create plain arrays/objects.
   */
  async function handleSubmit(event: Event) {
    event.preventDefault();
    // Sanitize the tags array to remove proxy wrapper
    formState.tags = [...tags];
    if (mode === 'create') {
      await createServiceType();
    } else if (mode === 'suggest') {
      await suggestServiceType();
    } else {
      await updateServiceType();
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
            <p class="text-error-500 mt-1 text-sm">{formState.errors.name}</p>
          {/if}
        </label>

        <label class="label">
          <span class="flex items-center justify-between">
            <span>Description <span class="text-error-500">*</span></span>
            <span class="text-surface-500 text-sm"
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
            <p class="text-error-500 mt-1 text-sm">{formState.errors.description}</p>
          {/if}
        </label>

        <label class="label">
          <span>Tags <span class="text-sm">(optional)</span></span>
          <InputChip
            bind:value={tags}
            name="tags"
            placeholder="Add relevant tags..."
            class="input-chip"
          />
          {#if formState.errors.tags}
            <p class="text-error-500 mt-1 text-sm">{formState.errors.tags}</p>
          {:else}
            <p class="text-surface-500 mt-1 text-sm">Press Enter or comma to create a new tag.</p>
          {/if}
        </label>
      </div>
    </section>

    <footer
      class="card-footer border-surface-200 dark:border-surface-700 flex items-center justify-end gap-2 border-t p-4"
    >
      <button
        type="button"
        class="btn variant-soft"
        onclick={() => onCancel()}
        disabled={formState.isSubmitting}
      >
        Cancel
      </button>
      <button
        type="submit"
        class="btn variant-filled-primary"
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
