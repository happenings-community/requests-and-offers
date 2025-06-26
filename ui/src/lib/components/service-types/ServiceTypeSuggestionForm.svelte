<script lang="ts">
  import { useServiceTypeFormManagement } from '$lib/composables';

  // Initialize the composable in suggestion mode
  const serviceTypeManagement = useServiceTypeFormManagement({
    mode: 'suggest'
  });

  // Handle form submission
  const handleSubmit = (e: Event) => {
    e.preventDefault();
    serviceTypeManagement.suggestServiceType();
  };

  // Handle mocked suggestion
  const suggestMockedServiceType = () => {
    serviceTypeManagement.createMockServiceType();
  };

  // Convert tags array to comma-separated string for display
  let tagsInput = $state('');

  // Initialize and sync tags input with composable
  $effect(() => {
    // Initialize from composable on first run
    if (tagsInput === '' && serviceTypeManagement.tags.length > 0) {
      tagsInput = serviceTypeManagement.tags.join(', ');
    }
  });

  // Handle input changes and update composable
  function handleTagsInputChange() {
    const tagsArray = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    serviceTypeManagement.setTags(tagsArray);
  }
</script>

<div class="card space-y-4 p-4">
  <h3 class="h3">Suggest a New Service Type</h3>
  <p>Have an idea for a new service category? Suggest it here. An administrator will review it.</p>
  <form onsubmit={handleSubmit} class="space-y-4">
    <label class="label block">
      <span>Name</span>
      <input
        class="input w-full"
        class:input-error={serviceTypeManagement.errors.name}
        type="text"
        bind:value={serviceTypeManagement.name}
        placeholder="e.g., Web Development"
        disabled={serviceTypeManagement.isSubmitting}
      />
      {#if serviceTypeManagement.errors.name}
        <p class="text-error-500 mt-1 text-sm">{serviceTypeManagement.errors.name}</p>
      {/if}
    </label>

    <label class="label block">
      <span>Description</span>
      <textarea
        class="textarea w-full"
        class:input-error={serviceTypeManagement.errors.description}
        rows="3"
        bind:value={serviceTypeManagement.description}
        placeholder="Brief description of this service type"
        disabled={serviceTypeManagement.isSubmitting}
      ></textarea>
      {#if serviceTypeManagement.errors.description}
        <p class="text-error-500 mt-1 text-sm">{serviceTypeManagement.errors.description}</p>
      {/if}
    </label>

    <label class="label block">
      <span>Tags (comma-separated)</span>
      <input
        class="input w-full"
        class:input-error={serviceTypeManagement.errors.tags}
        type="text"
        bind:value={tagsInput}
        oninput={handleTagsInputChange}
        placeholder="design, ux, frontend"
        disabled={serviceTypeManagement.isSubmitting}
      />
      {#if serviceTypeManagement.errors.tags}
        <p class="text-error-500 mt-1 text-sm">{serviceTypeManagement.errors.tags}</p>
      {/if}
    </label>

    <!-- Submit buttons -->
    <div class="flex justify-around">
      <button
        type="submit"
        class="variant-filled-primary btn"
        disabled={!serviceTypeManagement.isValid || serviceTypeManagement.isSubmitting}
      >
        {#if serviceTypeManagement.isSubmitting}
          <span class="mr-2 animate-spin">🌀</span>
          Submitting...
        {:else}
          Suggest
        {/if}
      </button>
      <button
        type="button"
        class="variant-filled-tertiary btn"
        onclick={suggestMockedServiceType}
        disabled={serviceTypeManagement.isSubmitting}
      >
        {#if serviceTypeManagement.isSubmitting}
          <span class="mr-2 animate-spin">🌀</span>
          Loading...
        {:else}
          Suggest Mocked Service Type
        {/if}
      </button>
    </div>
  </form>

  {#if serviceTypeManagement.submissionError}
    <div class="alert variant-filled-error">
      <p>{serviceTypeManagement.submissionError}</p>
    </div>
  {/if}
</div>
