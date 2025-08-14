<script lang="ts">
  import { useServiceTypeFormManagement } from '$lib/composables';
  import { shouldShowMockButtons } from '$lib/services/devFeatures.service';

  const { state, createMockedServiceType, suggestServiceType } = useServiceTypeFormManagement();

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    suggestServiceType();
  };

  const suggestMockedServiceType = () => {
    // You might want to pass some mock data here
    createMockedServiceType({
      name: 'Mocked Service',
      description: 'This is a mocked service type for testing purposes.',
      technical: true,
      status: 'pending'
    });
  };
</script>

<div class="card space-y-4 p-4">
  <h3 class="h3">Suggest a New Service Type</h3>
  <p>Have an idea for a new service category? Suggest it here. An administrator will review it.</p>
  <form onsubmit={handleSubmit} class="space-y-4">
    <label class="label block">
      <span>Name</span>
      <input
        class="input w-full"
        type="text"
        bind:value={state.name}
        placeholder="e.g., Web Development"
      />
      {#if state.errors.name}
        <p class="mt-1 text-sm text-error-500">{state.errors.name}</p>
      {/if}
    </label>

    <label class="label block">
      <span>Description</span>
      <textarea
        class="textarea w-full"
        rows="3"
        bind:value={state.description}
        placeholder="Brief description of this service type"
      ></textarea>
      {#if state.errors.description}
        <p class="mt-1 text-sm text-error-500">{state.errors.description}</p>
      {/if}
    </label>

    <label class="label block">
      <span>Classification</span>
      <div class="space-y-2">
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="technical"
            value="true"
            bind:group={state.technical}
          />
          <span>Technical Service</span>
        </label>
        <label class="flex items-center space-x-2">
          <input
            type="radio"
            class="radio"
            name="technical"
            value="false"
            bind:group={state.technical}
          />
          <span>Non-Technical Service</span>
        </label>
      </div>
      {#if state.errors.technical}
        <p class="mt-1 text-sm text-error-500">{state.errors.technical}</p>
      {/if}
    </label>

    <!-- Submit buttons -->
    <div class="flex justify-around">
      <button type="submit" class="variant-filled-primary btn"> Suggest </button>
      {#if shouldShowMockButtons()}
        <button
          type="button"
          class="variant-filled-tertiary btn"
          onclick={suggestMockedServiceType}
        >
          Suggest Mocked Service Type
        </button>
      {/if}
    </div>
  </form>

  {#if state.submissionError}
    <div class="alert variant-filled-error">
      <p>{state.submissionError}</p>
    </div>
  {/if}
</div>
