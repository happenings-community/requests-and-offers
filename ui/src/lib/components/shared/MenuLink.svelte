<script lang="ts">
  import { getDrawerStore } from '@skeletonlabs/skeleton';
  import type { Snippet } from 'svelte';

  let {
    href,
    className,
    children
  }: {
    href: string;
    className?: string;
    children: Snippet;
  } = $props();

  const drawerStore = getDrawerStore();
</script>

<a
  {href}
  class="btn {className ? className : 'variant-filled-secondary'} rounded-lg"
  onclick={() => drawerStore.close()}
>
  {@render children()}
</a>
