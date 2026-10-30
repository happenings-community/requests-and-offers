<script lang="ts">
  import { getDrawerStore } from '@skeletonlabs/skeleton';
  import { page } from '$app/state';
  import { isCurrentPage } from '$lib/utils/document';
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
  aria-current={isCurrentPage(href, page.url) ? 'page' : undefined}
  class="btn {className ? className : 'variant-filled-secondary'} rounded-lg"
  onclick={() => drawerStore.close()}
>
  {@render children()}
</a>
