<script lang="ts">
  /**
   * A tooltip drawn by the app, under a nav bar item whose word is not on screen.
   *
   * The `title` attribute is not shown reliably by Electron on macOS (the walk of 16
   * November found none), so the bar draws its own: on hover, and on keyboard focus,
   * which `title` never covered. It is for the eye only (`aria-hidden`): the item carries
   * its name for a screen reader in its label or its hidden words.
   *
   * The item it sits in needs `group relative`.
   */
  type Props = { text: string; class?: string };
  const { text, class: className = '' }: Props = $props();
</script>

<span
  class="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-surface-900 px-2 py-1 text-xs font-normal text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 {className}"
  aria-hidden="true"
  data-testid="nav-tip">{text}</span
>
