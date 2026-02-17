<script lang="ts">
  type Props = {
    textarea: HTMLTextAreaElement | undefined;
    value: string;
    onchange: (newValue: string) => void;
  };

  const { textarea, value, onchange }: Props = $props();

  function insertMarkdown(before: string, after: string) {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);

    const newValue = value.substring(0, start) + before + selected + after + value.substring(end);
    onchange(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start + before.length, end + before.length);
      } else {
        const cursorPos = start + before.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }

  function insertLinePrefix(prefix: string) {
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;

    const newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart);
    onchange(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }
</script>

<div
  class="variant-soft-surface flex items-center gap-1 rounded-t-lg border-b border-surface-500/30 px-2 py-1"
>
  <button
    type="button"
    class="variant-ghost-surface btn btn-sm px-2 font-bold"
    title="Bold"
    onclick={() => insertMarkdown('**', '**')}
  >
    B
  </button>
  <button
    type="button"
    class="variant-ghost-surface btn btn-sm px-2 italic"
    title="Italic"
    onclick={() => insertMarkdown('*', '*')}
  >
    I
  </button>
  <button
    type="button"
    class="variant-ghost-surface btn btn-sm px-2"
    title="Heading"
    onclick={() => insertLinePrefix('## ')}
  >
    H
  </button>
  <button
    type="button"
    class="variant-ghost-surface btn btn-sm px-2"
    title="List"
    onclick={() => insertLinePrefix('- ')}
  >
    &bull;
  </button>
  <span class="ml-auto text-xs opacity-50">Supports Markdown formatting</span>
</div>
