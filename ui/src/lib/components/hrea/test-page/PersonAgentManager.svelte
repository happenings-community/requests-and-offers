<script lang="ts">
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import { runEffect } from '$lib/utils/effect';

  let name = $state('');
  let note = $state('');

  function createPerson() {
    if (!name) return;
    runEffect(hreaStore.createPerson({ name, note }));
    name = '';
    note = '';
  }
</script>

<div class="card mt-4 space-y-4 p-4">
  <h3 class="h3">👤 Person Agents</h3>
  <p class="!text-sm">
    Agents are people, organizations, or groups that participate in economic activities.
  </p>
  <div class="flex flex-col space-y-2">
    <label class="label">
      <span>Name</span>
      <input class="input" type="text" bind:value={name} placeholder="Enter agent name" />
    </label>
    <label class="label">
      <span>Note (Optional)</span>
      <input class="input" type="text" bind:value={note} placeholder="Enter a short note" />
    </label>
    <button
      class="btn variant-filled-primary"
      onclick={createPerson}
      disabled={hreaStore.loading || !name}
    >
      {#if hreaStore.loading}
        <span class="loading-spinner" aria-label="Loading"></span>
        <span>Creating...</span>
      {:else}
        Create Person
      {/if}
    </button>
  </div>

  <!-- Results -->
  <div class="space-y-2">
    <h4 class="h4">Created Agents ({hreaStore.agents.length}):</h4>
    {#if hreaStore.agents.length > 0}
      <pre
        class="bg-surface-100-800-token max-h-64 overflow-x-auto rounded-md p-4">{@html JSON.stringify(
          hreaStore.agents,
          null,
          2
        )}</pre>
    {:else if !hreaStore.loading}
      <p>No agents have been created yet.</p>
    {/if}
  </div>
</div>
