<script lang="ts">
  import MarkdownToolbar from './MarkdownToolbar.svelte';
  import MarkdownRenderer from './MarkdownRenderer.svelte';

  type Props = {
    value?: string;
    name?: string;
    label?: string;
    labelClass?: string;
    placeholder?: string;
    rows?: number;
    maxLength?: number;
    required?: boolean;
    showCharacterCount?: boolean;
    height?: string;
    onchange?: (value: string) => void;
  };

  let {
    value = $bindable(''),
    name,
    label,
    labelClass = '',
    placeholder = 'Markdown supported',
    rows = 4,
    maxLength = 1000,
    required = false,
    showCharacterCount = true,
    height = '',
    onchange
  }: Props = $props();

  let textarea: HTMLTextAreaElement | undefined = $state(undefined);
  let mode: 'edit' | 'preview' = $state('edit');

  function handleToolbarChange(newValue: string) {
    value = newValue;
    onchange?.(newValue);
  }

  function handleTextareaInput() {
    // bind:value already syncs the textarea value into `value`;
    // this handler just fires the optional onchange callback.
    onchange?.(value);
  }
</script>

<label class="label {labelClass}">
  {#if label}
    <span>
      {label}{required ? '*' : ''} :
      {#if showCharacterCount}
        <span class="text-sm">({value.length}/{maxLength} characters)</span>
      {/if}
    </span>
  {/if}

  <div class="mb-1 flex justify-end gap-1">
    <button
      type="button"
      class="btn btn-sm {mode === 'edit' ? 'variant-filled-primary' : 'variant-ghost-surface'}"
      aria-pressed={mode === 'edit'}
      onclick={() => (mode = 'edit')}
    >
      Edit
    </button>
    <button
      type="button"
      class="btn btn-sm {mode === 'preview' ? 'variant-filled-primary' : 'variant-ghost-surface'}"
      aria-pressed={mode === 'preview'}
      onclick={() => (mode = 'preview')}
    >
      Preview
    </button>
  </div>

  <div class:hidden={mode !== 'edit'}>
    <MarkdownToolbar {textarea} {value} onchange={handleToolbarChange} />
    <textarea
      class="textarea rounded-t-none {height}"
      {name}
      {rows}
      maxlength={maxLength}
      {placeholder}
      {required}
      bind:this={textarea}
      bind:value
      oninput={handleTextareaInput}
    ></textarea>
  </div>

  {#if mode === 'preview'}
    <div class="card variant-soft overflow-y-auto p-4 {height}">
      {#if value.trim()}
        <MarkdownRenderer content={value} />
      {:else}
        <p class="italic text-surface-400">
          Nothing to preview yet — switch to Edit mode and type some markdown.
        </p>
      {/if}
    </div>
  {/if}
</label>
