<!--
  @component
  The top of a list page, drawn one way on every one (#350, #387; Sam's walk of
  20 November): a bold title at the left, as the design system's h1, an optional line under
  it, and the page's own buttons at the right, which wrap under the title on a narrow screen.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    subtitle?: string;
    /** The page's own buttons, such as "+ Request". */
    actions?: Snippet;
  };

  let { title, subtitle, actions }: Props = $props();
</script>

<header class="flex flex-wrap items-end justify-between gap-4" data-testid="page-header">
  <div class="space-y-1">
    <h1 class="h1 font-bold tracking-[-0.02em]">{title}</h1>
    {#if subtitle}
      <p class="text-surface-500">{subtitle}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex flex-wrap items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</header>
