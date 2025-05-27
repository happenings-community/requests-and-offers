<script lang="ts">
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { UIServiceType } from '$lib/types/ui';
  import type { ServiceTypeInDHT } from '$lib/types/holochain';

  type Props = {
    mode: 'create' | 'edit';
    serviceType?: UIServiceType;
    onSubmit: (input: ServiceTypeInDHT) => Promise<void>;
    onCancel: () => void;
  };

  const { mode, serviceType, onSubmit, onCancel }: Props = $props();

  // Form state
  let name = $state(serviceType?.name ?? '');
  let description = $state(serviceType?.description ?? '');
  let tags = $state<string[]>(serviceType?.tags ?? []);
  let submitting = $state(false);

  // Validation state
  let nameError = $state('');
  let descriptionError = $state('');
  let tagsError = $state('');

  // Form validation
  const isValid = $derived(
    name.trim().length > 0 &&
    description.trim().length > 0 &&
    tags.length > 0 &&
    !nameError &&
    !descriptionError &&
    !tagsError
  );

  // Validate name
  function validateName() {
    nameError = '';
    if (!name.trim()) {
      nameError = 'Name is required';
    } else if (name.trim().length < 2) {
      nameError = 'Name must be at least 2 characters';
    } else if (name.trim().length > 50) {
      nameError = 'Name must be less than 50 characters';
    }
  }

  // Validate description
  function validateDescription() {
    descriptionError = '';
    if (!description.trim()) {
      descriptionError = 'Description is required';
    } else if (description.trim().length < 10) {
      descriptionError = 'Description must be at least 10 characters';
    } else if (description.trim().length > 500) {
      descriptionError = 'Description must be less than 500 characters';
    }
  }

  // Validate tags
  function validateTags() {
    tagsError = '';
    if (tags.length === 0) {
      tagsError = 'At least one tag is required';
    } else if (tags.some(tag => !tag.trim())) {
      tagsError = 'Tags cannot be empty';
    } else if (tags.some(tag => tag.length > 30)) {
      tagsError = 'Tags must be less than 30 characters each';
    }
  }

  // Handle form submission
  async function handleSubmit(event: Event) {
    event.preventDefault();

    // Validate all fields
    validateName();
    validateDescription();
    validateTags();

    if (!isValid) {
      return;
    }

    submitting = true;

    try {
      const input: ServiceTypeInDHT = {
        name: name.trim(),
        description: description.trim(),
        tags: tags.map(tag => tag.trim()).filter(tag => tag.length > 0)
      };

      await onSubmit(input);
    } catch (error) {
      console.error('Error submitting service type:', error);
    } finally {
      submitting = false;
    }
  }

  // Handle cancel
  function handleCancel() {
    // Reset form if creating
    if (mode === 'create') {
      name = '';
      description = '';
      tags = [];
      nameError = '';
      descriptionError = '';
      tagsError = '';
    }
    onCancel();
  }
</script>

<form class="space-y-4" onsubmit={handleSubmit}>
  <!-- Name -->
  <label class="label">
    <span>Name <span class="text-error-500">*</span></span>
    <input
      type="text"
      class="input"
      class:input-error={nameError}
      placeholder="Enter service type name"
      bind:value={name}
      onblur={validateName}
      oninput={() => nameError = ''}
      required
      maxlength="50"
    />
    {#if nameError}
      <p class="text-error-500 mt-1 text-sm">{nameError}</p>
    {/if}
  </label>

  <!-- Description -->
  <label class="label">
    <span>
      Description <span class="text-error-500">*</span>
      <span class="text-sm">({description.length}/500 characters)</span>
    </span>
    <textarea
      class="textarea"
      class:input-error={descriptionError}
      placeholder="Describe this service type in detail"
      rows="4"
      bind:value={description}
      onblur={validateDescription}
      oninput={() => descriptionError = ''}
      required
      maxlength="500"
    ></textarea>
    {#if descriptionError}
      <p class="text-error-500 mt-1 text-sm">{descriptionError}</p>
    {/if}
  </label>

  <!-- Tags -->
  <label class="label">
    <span>Tags <span class="text-error-500">*</span> (categories, keywords, etc.)</span>
    <InputChip
      bind:value={tags}
      name="tags"
      placeholder="Add tags (press Enter to add)"
      validation={(tag) => {
        const trimmed = tag.trim();
        return trimmed.length > 0 && trimmed.length <= 30;
      }}
      onblur={validateTags}
      oninput={() => tagsError = ''}
    />
    {#if tagsError}
      <p class="text-error-500 mt-1 text-sm">{tagsError}</p>
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
      onclick={handleCancel}
      disabled={submitting}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="btn variant-filled-primary"
      disabled={!isValid || submitting}
    >
      {#if submitting}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      {mode === 'create' ? 'Create Service Type' : 'Update Service Type'}
    </button>
  </div>
</form> 