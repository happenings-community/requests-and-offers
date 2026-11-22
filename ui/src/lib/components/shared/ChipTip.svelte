<script lang="ts">
  /**
   * The whole text of a chip cut short with an ellipsis, drawn by the app above the chip.
   *
   * The service type and medium tags stay on one line and cut a long name (#576). Their
   * `title` is not shown reliably by Electron on macOS (see NavTip), so a cut name could not
   * be read in the desktop app. This shows it on hover, and on keyboard focus where the tag
   * is a link (a tag drawn as a plain span takes no focus). A listing table clips what
   * overflows it on every side (Skeleton's `.table` is `overflow: hidden`), so the tip sits
   * above the chip, where a cell's and the header's padding leave room for a few lines, and
   * it wraps within 20rem. It is for the eye only (`aria-hidden`): the whole name is already
   * in the chip's markup for a screen reader. The chip keeps its `title`, which also carries
   * a service type's description, so where `title` does show, both can appear.
   *
   * `!ml-0` because Skeleton gives every chip child after the first a left margin (0.5rem,
   * from a rule a plain `ml-0` loses to), which pushed the tip off centre.
   *
   * The chip it sits in needs `group relative`; the tag renders it only while its text is
   * actually cut (`isCut`), so a short name gets no tip.
   */
  type Props = { text: string };
  const { text }: Props = $props();
</script>

<span
  class="pointer-events-none absolute bottom-full left-1/2 z-50 !ml-0 mb-1 w-max max-w-xs -translate-x-1/2 whitespace-normal break-words rounded bg-surface-900 px-2 py-1 text-left text-xs font-normal text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
  aria-hidden="true"
  data-testid="chip-tip">{text}</span
>
