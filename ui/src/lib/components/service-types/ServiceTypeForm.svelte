<script lang="ts">
  import { InputChip } from '@skeletonlabs/skeleton';
  import type { ServiceTypeInDHT } from '$lib/types/holochain';
  import { useServiceTypeFormManagement } from '$lib/composables';

  type Props = {
    mode: 'create' | 'edit';
    serviceType?: ServiceTypeInDHT;
    onSubmit: (input: ServiceTypeInDHT) => Promise<void>;
    onCancel: () => void;
  };

  const { mode, serviceType, onSubmit, onCancel }: Props = $props();

  // Initialize the composable
  const serviceTypeManagement = useServiceTypeFormManagement({
    initialValues: serviceType,
    mode,
    onSubmitSuccess: async (result) => {
      // Convert UIServiceType back to ServiceTypeInDHT for the callback
      const serviceTypeInput: ServiceTypeInDHT = {
        name: result.name,
        description: result.description,
        tags: result.tags
      };
      await onSubmit(serviceTypeInput);
    }
  });

  // Local state for InputChip component
  let localTags = $state([...serviceTypeManagement.tags]);

  // Sync local tags with composable
  $effect(() => {
    serviceTypeManagement.setTags(localTags);
  });

  // Handle form submission
  async function handleSubmit(event: Event) {
    event.preventDefault();
    await serviceTypeManagement.submitServiceType();
  }
</script>

<form class="space-y-4" onsubmit={handleSubmit}>
  <!-- Name -->
  <label class="label">
    <span>Name <span class="text-error-500">*</span></span>
    <input
      type="text"
      class="input"
      class:input-error={serviceTypeManagement.errors.name}
      placeholder="Enter service type name"
      bind:value={serviceTypeManagement.name}
      required
      minlength="2"
      maxlength="100"
    />
    {#if serviceTypeManagement.errors.name}
      <p class="text-error-500 mt-1 text-sm">{serviceTypeManagement.errors.name}</p>
    {/if}
  </label>

  <!-- Description -->
  <label class="label">
    <span>
      Description <span class="text-error-500">*</span>
      <span class="text-sm">({serviceTypeManagement.description.length}/500 characters)</span>
    </span>
    <textarea
      class="textarea"
      class:input-error={serviceTypeManagement.errors.description}
      placeholder="Describe this service type in detail"
      rows="4"
      bind:value={serviceTypeManagement.description}
      required
      minlength="10"
      maxlength="500"
    ></textarea>
    {#if serviceTypeManagement.errors.description}
      <p class="text-error-500 mt-1 text-sm">{serviceTypeManagement.errors.description}</p>
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
        return trimmed.length >= 1 && trimmed.length <= 50;
      }}
    />
    {#if serviceTypeManagement.errors.tags}
      <p class="text-error-500 mt-1 text-sm">{serviceTypeManagement.errors.tags}</p>
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
      disabled={serviceTypeManagement.isSubmitting}
    >
      Cancel
    </button>
    <button
      type="submit"
      class="btn variant-filled-primary"
      disabled={!serviceTypeManagement.isValid || serviceTypeManagement.isSubmitting}
    >
      {#if serviceTypeManagement.isSubmitting}
        <span class="loading loading-spinner loading-sm"></span>
      {/if}
      {mode === 'create' ? 'Create Service Type' : 'Update Service Type'}
    </button>
  </div>
</form>
