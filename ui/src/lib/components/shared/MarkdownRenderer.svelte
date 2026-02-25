<script lang="ts">
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

  type Props = {
    content: string;
    class?: string;
  };

  const { content, class: className = '' }: Props = $props();

  marked.setOptions({
    breaks: true,
    gfm: true
  });

  const html = $derived(DOMPurify.sanitize(marked.parse(content || '') as string));
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
