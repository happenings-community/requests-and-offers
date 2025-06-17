<script lang="ts">
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ServiceTypeInDHT } from '$lib/types/holochain';
  import { useFormValidation } from '$lib/composables/ui/useFormValidation.svelte';
  import { ServiceTypeSchema } from '$lib/schemas';
  import * as Effect from 'effect/Effect';
  import { useToast } from '$lib/composables';
  import type { ServiceTypeSchema as ServiceTypeFormFields } from '$lib/schemas';
  import * as E from 'effect/Either';

  type Props = {
    mode: 'create' | 'edit';
    serviceType?: ServiceTypeFormFields;
    onSubmit: (input: ServiceTypeInDHT) => Promise<void>;
    onCancel: () => void;
  };

  const { mode, serviceType, onSubmit, onCancel }: Props = $props();
  const toast = useToast();

  const form = useFormValidation({
    schema: ServiceTypeSchema,
    initialValues: serviceType || {
      name: '',
      description: '',
      tags: []
    }
  });

  let submitting = $state(false);
  let localTags = $state([...form.values.tags]);

  $effect(() => {
    form.updateField('tags', localTags);
  });

  // Handle form submission
  async function handleSubmit(event: Event) {
    event.preventDefault();
    submitting = true;

    const validationEffect = form.validateForm();
    const result = await Effect.runPromise(Effect.either(validationEffect));

    if (E.isLeft(result)) {
      toast.error('Please correct the errors before submitting.');
      submitting = false;
      return;
    }

    try {
      await onSubmit({ ...result.right, tags: [...result.right.tags] });
    } catch (error) {
      console.error('Error submitting service type:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      submitting = false;
    }
  }
</script>

<form class="space-y-4" onsubmit={handleSubmit}>
  <!-- Name -->
  <label class="label">
    <span>Name <span class="text-error-500">*</span></span>
    <input
      type="text"
      class="input"
      class:input-error={form.errors.name}
      placeholder="Enter service type name"
      bind:value={form.values.name}
      onblur={() => form.setTouched('name', true)}
      required
      maxlength="50"
    />
    {#if form.errors.name && form.touched.name}
      <p class="text-error-500 mt-1 text-sm">{form.errors.name}</p>
    {/if}
  </label>

  <!-- Description -->
  <label class="label">
    <span>
      Description <span class="text-error-500">*</span>
      <span class="text-sm">({form.values.description.length}/500 characters)</span>
    </span>
    <textarea
      class="textarea"
      class:input-error={form.errors.description}
      placeholder="Describe this service type in detail"
      rows="4"
      bind:value={form.values.description}
      onblur={() => form.setTouched('description', true)}
      required
      maxlength="500"
    ></textarea>
    {#if form.errors.description && form.touched.description}
      <p class="text-error-500 mt-1 text-sm">{form.errors.description}</p>
    {/if}
  </label>

  <!-- Tags -->
  <label class="label">
    <span>Tags <span class="text-error-500">*</span> (categories, keywords, etc.)</span>
    <InputChip
      bind:value={localTags}
      name="tags"
      placeholder="Add tags (press Enter to add)"
      validation={(tag) => {
        const trimmed = tag.trim();
        return trimmed.length > 0 && trimmed.length <= 30;
      }}
      onblur={() => form.setTouched('tags', true)}
    />
    {#if form.errors.tags && form.touched.tags}
      <p class="text-error-500 mt-1 text-sm">{form.errors.tags}</p>
    {:else}
      <p class="text-surface-600 mt-1 text-sm">
        Add relevant tags to help categorize and search for this service type
      </p>
    {/if}
  </label>

  <!-- Form Actions -->
  <div class="flex justify-end space-x-2">
    <button
      type="button"
      class="btn variant-ghost-surface"
      onclick={onCancel}
      disabled={submitting}
    >
      Cancel
    </button>
    <button type="submit" class="btn variant-filled-primary" disabled={!form.isValid || submitting}>
      {#if submitting}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      {mode === 'create' ? 'Create Service Type' : 'Update Service Type'}
    </button>
  </div>
</form> 