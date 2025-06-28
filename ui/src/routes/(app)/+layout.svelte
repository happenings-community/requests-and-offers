<script lang="ts">
  import { ConicGradient, type ConicStop, Toast } from '@skeletonlabs/skeleton';
  import NavBar from '$lib/components/shared/NavBar.svelte';
  import { onMount } from 'svelte';
  import hc from '$lib/services/HolochainClientService.svelte';
  import { initializeToast } from '$lib/utils/toast';
  import hreaStore from '$lib/stores/hrea.store.svelte';
  import { Effect as E } from 'effect';
  import { runEffect } from '@/lib/utils/effect';

  type Props = {
    children: any;
  };

  let { children }: Props = $props();

  initializeToast();

  onMount(() => {
    const htmlElement = document.getElementsByTagName('html')[0];
    htmlElement.classList.remove('dark');
    runEffect(hreaStore.initialize());
  });

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];
</script>

<Toast />

<div class="grid min-h-screen grid-rows-[auto_1fr]">
  <NavBar />

  <main class="flex flex-col items-center justify-center py-10">
    {#if !hc.isConnected || hreaStore.loading}
      <p>Connecting to Holochain...</p>
      {#if hreaStore.loading}
        <p>Connecting to hREA...</p>
      {/if}
      <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
      {#if hreaStore.error}
        <div class="alert variant-filled-error">
          <div class="alert-message">
            <h3 class="h3">hREA Connection Error</h3>
            <p>{hreaStore.error.message}</p>
          </div>
        </div>
      {/if}
    {:else}
      {@render children()}
    {/if}
  </main>
</div>
