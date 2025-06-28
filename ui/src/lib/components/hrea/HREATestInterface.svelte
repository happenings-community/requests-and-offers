<script lang="ts">
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import { runEffect } from '@/lib/utils/effect';

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
  <h2 class="h2">hREA Operations</h2>

  <!-- Create Person Form -->
  <div class="space-y-2">
    <h3 class="h3">👤 Create Person Agent</h3>
    <p>Agents are people, organizations, or groups that participate in economic activities.</p>
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
          <span class="loading-spinner"></span>
          <span>Creating...</span>
        {:else}
          Create Person
        {/if}
      </button>
    </div>
  </div>

  <!-- Results -->
  <div class="space-y-2">
    <h3 class="h3">Results:</h3>

    {#if hreaStore.error}
      <div class="alert variant-filled-error">
        <p>{hreaStore.error.message}</p>
      </div>
    {/if}

    {#if hreaStore.agents.length > 0}
      <div class="space-y-2">
        <h4 class="h4">Agents ({hreaStore.agents.length}):</h4>
        <pre class="bg-surface-100-800-token overflow-x-auto rounded-md p-4">{@html JSON.stringify(
            hreaStore.agents,
            null,
            2
          )}</pre>
      </div>
    {:else if !hreaStore.loading}
      <p>No agents found. Create one using the form above.</p>
    {/if}
  </div>
</div>
