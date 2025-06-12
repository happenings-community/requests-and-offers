<script lang="ts">
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import type { ServiceTypeInDHT } from '$lib/types/holochain';
  import { Effect as E, pipe } from 'effect';

  let name = $state('');
  let description = $state('');
  let tagsInput = $state('');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!name.trim()) {
      error = 'Service type name cannot be empty.';
      return;
    }

    if (!description.trim()) {
      error = 'Service type description cannot be empty.';
      return;
    }

    loading = true;
    error = null;
    success = null;

    // For a suggestion, we only need the name.
    // The other fields can be empty as they are not used in the suggestion process.
    const newServiceType: ServiceTypeInDHT = {
      name: name.trim(),
      description: description.trim(),
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    };

    pipe(
      serviceTypesStore.suggestServiceType(newServiceType),
      E.tap(() => {
        success = `Successfully suggested "${name.trim()}". It is now pending review.`;
        name = '';
        description = '';
        tagsInput = '';
      }),
      E.catchAll((e) => {
        error = e.message;
        return E.void;
      }),
      E.ensuring(
        E.sync(() => {
          loading = false;
        })
      ),
      E.runPromise
    );
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
        bind:value={name}
        placeholder="e.g., Web Development"
        disabled={loading}
      />
    </label>

    <label class="label block">
      <span>Description</span>
      <textarea
        class="textarea w-full"
        rows="3"
        bind:value={description}
        placeholder="Brief description of this service type"
        disabled={loading}
      ></textarea>
    </label>

    <label class="label block">
      <span>Tags (comma-separated)</span>
      <input
        class="input w-full"
        type="text"
        bind:value={tagsInput}
        placeholder="design, ux, frontend"
        disabled={loading}
      />
    </label>

    <button type="submit" class="variant-filled-primary btn" disabled={loading}>
      {#if loading}
        <span class="mr-2 animate-spin">🌀</span>
        Submitting...
      {:else}
        Suggest
      {/if}
    </button>
  </form>

  {#if error}
    <div class="alert variant-filled-error">
      <p>{error}</p>
    </div>
  {/if}

  {#if success}
    <div class="alert variant-filled-success">
      <p>{success}</p>
    </div>
  {/if}
</div>
