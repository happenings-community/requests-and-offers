<script lang="ts">
  import { page } from '$app/state';
  import { AppShell } from '@skeletonlabs/skeleton';
  import NavBar from '@lib/components/shared/NavBar.svelte';
</script>

<AppShell>
  <svelte:fragment slot="header">
    <NavBar />
  </svelte:fragment>

  <main
    class="container mx-auto flex min-h-screen flex-col items-center justify-center px-5 pb-10 pt-40"
  >
    <div class="space-y-4">
      <h1 class="h1 text-red-600">Error: {page.status}</h1>
      <p class="font-bold">{page.error?.message}</p>
    </div>
  </main>
</AppShell>
