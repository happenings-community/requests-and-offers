<script lang="ts">
  import { page } from '$app/state';
</script>

<main
  class="container mx-auto flex min-h-screen flex-col items-center justify-center px-5 pb-10 pt-20"
>
  <div class="space-y-4 text-center">
    <h1 class="h1 text-red-600">Error: {page.status}</h1>
    <p class="font-bold">{page.error?.message}</p>
    {#if page.status === 404}
      <p class="text-gray-600">The page you're looking for doesn't exist.</p>
      <a href="/" class="variant-filled-primary btn">Go Home</a>
    {/if}
  </div>
</main>
