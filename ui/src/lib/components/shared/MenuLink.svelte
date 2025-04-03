<script lang="ts">
  import { getDrawerStore } from '@skeletonlabs/skeleton';

  type Props = {
    href: string;
    className?: string;
    children: any;
  };

  let { href, className, children }: Props = $props();

  const drawerStore = getDrawerStore();
</script>

<a
  {href}
  class="btn {className ? className : 'variant-filled-secondary'} rounded-lg"
  onclick={() => drawerStore.close()}
>
  {@render children()}
</a>
