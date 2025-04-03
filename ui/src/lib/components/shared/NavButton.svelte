<script lang="ts">
  import { goto } from '$app/navigation';

  type Props = {
    className?: string;
    href: string;
    children: any;
  };

  let { className, href, children }: Props = $props();
</script>

<button class="btn {className ? className : 'variant-filled-primary'} " onclick={() => goto(href)}>
  {@render children()}
</button>
