<script module lang="ts">
  let nextId = 0;
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { menuKeyTarget } from '$lib/utils/menu-keys';

  /**
   * A nav menu that opens on hover, click, Enter, Space or ArrowDown (#204).
   * Arrow keys, Home and End move between items; Escape closes and returns
   * focus to the trigger; leaving the menu with Tab or the pointer closes it.
   */
  type Props = {
    title: string;
    items: Array<{
      href: string;
      label: string;
      icon: string;
      description?: string;
      badge?: number;
    }>;
    alignRight?: boolean;
    /** A picture shown before the title: the member's own menu. */
    avatar?: string;
    /** What a badge's number counts, for screen readers: "3 waiting on you". */
    badgeLabel?: string;
  };

  let { title, items, alignRight = false, avatar, badgeLabel = 'waiting on you' }: Props = $props();

  const total = $derived(items.reduce((n, item) => n + (item.badge ?? 0), 0));
  const shown = (n: number) => (n > 9 ? '9+' : String(n));

  const id = `nav-menu-${nextId++}`;
  let open = $state(false);
  let trigger: HTMLButtonElement;
  let wrapper: HTMLDivElement;
  const links: HTMLAnchorElement[] = [];

  async function focusItem(index: number) {
    open = true;
    await tick();
    links[index]?.focus();
  }

  function close(returnFocus = false) {
    open = false;
    if (returnFocus) trigger?.focus();
  }

  // A pointer click opens (hover may already have); keyboard activation is
  // handled in onTriggerKey, and a click it synthesises has detail 0.
  function onTriggerClick(event: MouseEvent) {
    if (event.detail > 0) open = true;
  }

  function onTriggerKey(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(items.length - 1);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close(true);
    }
  }

  function onItemKey(event: KeyboardEvent, index: number) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    const target = menuKeyTarget(event.key, index, items.length);
    if (target !== null) {
      event.preventDefault();
      links[target]?.focus();
    }
  }

  // Focus moving outside the menu (Tab past the last item) closes it.
  function onFocusOut(event: FocusEvent) {
    if (!wrapper?.contains(event.relatedTarget as Node | null)) open = false;
  }
</script>

<div
  class="group relative"
  role="presentation"
  onmouseenter={() => (open = true)}
  onmouseleave={() => (open = false)}
  onfocusout={onFocusOut}
  bind:this={wrapper}
>
  <button
    class="inline-flex items-center whitespace-nowrap rounded px-3 py-2 transition-colors hover:text-secondary-300 focus:outline-none focus:ring-2 focus:ring-secondary-300 focus:ring-opacity-50"
    id="{id}-trigger"
    bind:this={trigger}
    aria-expanded={open}
    aria-haspopup="menu"
    aria-controls={id}
    onclick={onTriggerClick}
    onkeydown={onTriggerKey}
    aria-label={total > 0 ? `${title} menu, ${total} ${badgeLabel}` : `${title} menu`}
  >
    {#if avatar}
      <img
        src={avatar}
        alt=""
        class="mr-2 h-8 w-8 rounded-full bg-surface-200 object-cover"
      />
    {/if}
    <!-- With a picture, the name shows only where there is room for it. -->
    <span class={avatar ? 'hidden max-w-[10rem] truncate xl:inline' : ''}>{title}</span>
    {#if total > 0}
      <span class="badge ml-1 bg-white px-1.5 py-0 text-xs font-semibold text-primary-700" aria-hidden="true">{shown(total)}</span>
    {/if}
    <svg
      class="ml-1 h-4 w-4 shrink-0 transition-transform duration-200 {open
        ? 'rotate-180'
        : ''}"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"
      ></path>
    </svg>
  </button>

  {#if open}
  <!-- pt-1 rather than a margin, so the pointer can cross to the menu without leaving it -->
  <div class="absolute top-full z-50 w-64 pt-1 {alignRight ? 'right-0' : 'left-0'}">
  <div
    class="rounded-lg border border-gray-200 bg-white shadow-xl"
    {id}
    role="menu"
    aria-labelledby="{id}-trigger"
  >
    <div class="py-2">
      {#each items as item, index}
        <a
          href={item.href}
          class="block px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
          role="menuitem"
          tabindex="-1"
          bind:this={links[index]}
          onkeydown={(e) => onItemKey(e, index)}
          onclick={() => close()}
        >
          <div class="flex items-center gap-3">
            <span class="flex-shrink-0 text-lg">{item.icon}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 font-medium text-gray-900">
                {item.label}
                {#if item.badge}
                  <span
                    class="badge variant-filled-primary px-1.5 py-0 text-xs"
                    aria-label="{item.badge} {badgeLabel}"
                  >{shown(item.badge)}</span>
                {/if}
              </div>
              {#if item.description}
                <div class="truncate text-sm text-gray-500">{item.description}</div>
              {/if}
            </div>
          </div>
        </a>
      {/each}
    </div>
  </div>
  </div>
  {/if}
</div>
