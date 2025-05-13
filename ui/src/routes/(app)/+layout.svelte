<script lang="ts">
  import { ConicGradient, type ConicStop } from '@skeletonlabs/skeleton';
  import NavBar from '$lib/components/shared/NavBar.svelte';
  import { onMount } from 'svelte';
  import hc from '$lib/services/HolochainClientService.svelte';

  type Props = {
    children: any;
  };

  let { children }: Props = $props();

  onMount(() => {
    const htmlElement = document.getElementsByTagName('html')[0];
    htmlElement.classList.remove('dark');
  });

  const conicStops: ConicStop[] = [
    { color: 'transparent', start: 0, end: 0 },
    { color: 'rgb(var(--color-primary-500))', start: 75, end: 50 }
  ];
</script>

<div class="grid min-h-screen grid-rows-[auto_1fr]">
  <NavBar />

  <main class="flex flex-col items-center justify-center py-10">
    {#if !hc.isConnected}
      <p>Not connected yet.</p>
      <ConicGradient stops={conicStops} spin>Loading</ConicGradient>
    {:else}
      {@render children()}
    {/if}
  </main>
</div>
