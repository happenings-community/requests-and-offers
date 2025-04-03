<script lang="ts">
  import usersStore from '@stores/users.store.svelte';

  let isLoading = $state(true);
  let error: string | null = $state(null);
  let projects: any[] = $state([]);

  const { currentUser } = $derived(usersStore);

  async function fetchProjects() {
    try {
      isLoading = true;
      error = null;

      // Placeholder for future project fetching logic
      projects = [];
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      error = err instanceof Error ? err.message : 'Failed to load projects';
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    fetchProjects();
  });
</script>

<section class="container mx-auto p-4">
  <h1 class="h1 mb-6 text-center">Projects</h1>

  {#if error}
    <div class="alert variant-filled-error mb-4">
      <p>{error}</p>
      <button
        class="btn btn-sm variant-soft"
        onclick={() => {
          error = null;
          fetchProjects();
        }}
      >
        Retry
      </button>
    </div>
  {/if}

  {#if isLoading}
    <div class="flex h-64 items-center justify-center">
      <span class="loading loading-spinner text-primary"></span>
      <p class="ml-4">Loading projects...</p>
    </div>
  {:else if projects.length === 0}
    <div class="text-surface-500 text-center text-xl">
      {#if currentUser}
        Projets are not yet available. Coming soon!
      {:else}
        Please log in to view projects.
      {/if}
    </div>
  {:else}
    <div class="grid gap-4">
      {#each projects as project}
        <div class="card variant-soft p-4">
          <p>Project details will be added soon</p>
        </div>
      {/each}
    </div>
  {/if}
</section>
