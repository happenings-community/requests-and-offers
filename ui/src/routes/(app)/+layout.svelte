<script lang="ts">
  import { Toast } from '@skeletonlabs/skeleton';
  import NavBar from '$lib/components/shared/NavBar.svelte';
  import { onMount } from 'svelte';
  import { initializeToast } from '$lib/utils/toast';

  type Props = {
    children: any;
  };

  let { children }: Props = $props();

  initializeToast();

  onMount(() => {
    const htmlElement = document.getElementsByTagName('html')[0];
    htmlElement.classList.remove('dark');
  });
</script>

<Toast />

<div class="grid min-h-screen grid-rows-[auto_1fr]">
  <NavBar />

  <main class="flex flex-col items-center justify-center py-10">
    {@render children()}
  </main>
</div>
