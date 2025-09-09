<script lang="ts">
  import { goto } from '$app/navigation';
  import type { Snippet } from 'svelte';

  type Props = {
    className?: string;
    href: string;
    children: Snippet;
  };

  let { className, href, children }: Props = $props();
</script>

<button class="btn {className ? className : 'variant-filled-primary'} " onclick={() => goto(href)}>
  {@render children()}
</button>
