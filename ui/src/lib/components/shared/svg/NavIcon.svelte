<script lang="ts" module>
  /** The nav bar's icons, drawn as SVG: emoji do not render in every desktop build. */
  export type NavIconName = 'mail' | 'exchanges' | 'listings' | 'community';
</script>

<script lang="ts">
  type Props = { name: NavIconName; class?: string };
  const { name, class: className = 'h-5 w-5' }: Props = $props();
</script>

<!--
  Outline icons from Tabler Icons 3.52.0 (mail, arrows-exchange, list-details,
  heart-handshake), https://tabler.io/icons. MIT License, Copyright (c) 2020-2026
  Paweł Kuna. Decorative: the link or button around the icon carries its name.
-->
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  class="shrink-0 {className}"
  aria-hidden="true"
  focusable="false"
  data-icon={name}
>
  {#if name === 'mail'}
    <path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" />
    <path d="M3 7l9 6l9 -6" />
  {:else if name === 'exchanges'}
    <path d="M7 10h14l-4 -4" />
    <path d="M17 14h-14l4 4" />
  {:else if name === 'listings'}
    <path d="M13 5h8" />
    <path d="M13 9h5" />
    <path d="M13 15h8" />
    <path d="M13 19h5" />
    <path d="M3 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
    <path d="M3 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
  {:else if name === 'community'}
    <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
    <path
      d="M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25"
    />
    <path d="M12.5 15.5l2 2" />
    <path d="M15 13l2 2" />
  {/if}
</svg>
