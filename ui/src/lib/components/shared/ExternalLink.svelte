<script lang="ts">
  import { externalHref } from '$lib/utils/external-link';

  /**
   * A link another member typed. Opens in a new window only when it is a web address
   * (`http:` or `https:`); anything else is shown as plain text, never as a link.
   */
  let { text, class: className = '' }: { text: string; class?: string } = $props();

  const href = $derived(externalHref(text));
</script>

{#if href}
  <a {href} target="_blank" rel="noopener noreferrer" class={className}>{text}</a>
{:else}
  <span class="break-all">{text}</span>
{/if}
