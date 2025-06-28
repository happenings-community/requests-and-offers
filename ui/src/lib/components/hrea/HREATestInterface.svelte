<script lang="ts">
  import PersonAgentManager from '$lib/components/hrea/test-page/PersonAgentManager.svelte';
  import hreaStore from '$lib/stores/hrea.store.svelte';
</script>

<div class="card mt-4 space-y-4 p-4">
  <h2 class="h2">hREA Entity Explorer</h2>

  {#if hreaStore.error}
    <div class="alert variant-filled-error">
      <p>{hreaStore.error.message}</p>
    </div>
  {/if}

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <PersonAgentManager />
    <!-- Other managers will go here -->
  </div>
</div>
