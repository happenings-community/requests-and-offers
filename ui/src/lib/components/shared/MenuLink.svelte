<script lang="ts">
  import { getDrawerStore } from '@skeletonlabs/skeleton';

  let {
    href,
    className,
    children
  }: {
    href: string;
    className?: string;
    children: any;
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
