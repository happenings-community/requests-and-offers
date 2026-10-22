<script lang="ts">
  import { renderMarkdown } from '$lib/utils/markdown';

  type Props = {
    content: string;
    class?: string;
  };

  const { content, class: className = '' }: Props = $props();

  const html = $derived(renderMarkdown(content));
</script>

<div
  class="markdown-renderer prose prose-sm max-w-none text-[inherit] dark:prose-invert {className}"
>
  {@html html}
</div>

<style>
  .markdown-renderer :global(ul) {
    list-style-type: disc;
  }
  .markdown-renderer :global(li::marker) {
    color: rgb(var(--color-surface-700));
  }
  :global(.dark) .markdown-renderer :global(li::marker) {
    color: rgb(var(--color-surface-300));
  }
</style>
