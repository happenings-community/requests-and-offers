<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  // Redirect to service types page since tags are no longer supported
  onMount(() => {
    goto('/service-types');
  });
</script>

<svelte:head>
  <title>Redirecting... - Requests and Offers</title>
</svelte:head>

<section class="container mx-auto p-4 text-center">
  <div class="card p-8">
    <h1 class="h1 mb-4">Tags No Longer Supported</h1>
    <p class="mb-4 text-surface-600">
      Service types are now classified as Technical or Non-Technical instead of using tags.
    </p>
    <p class="mb-6 text-surface-600">
      Redirecting you to the Service Types page...
    </p>
    <a href="/service-types" class="variant-filled-primary btn">
      Go to Service Types
    </a>
  </div>
</section>