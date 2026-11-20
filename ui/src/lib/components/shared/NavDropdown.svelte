<script module lang="ts">
  let nextId = 0;
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { menuKeyTarget } from '$lib/utils/menu-keys';
  import { shownCount } from '$lib/utils/badge-count';
  import NavIcon, { type NavIconName } from '$lib/components/shared/svg/NavIcon.svelte';

  /**
   * A nav menu that opens on hover, click, Enter, Space or ArrowDown (#204).
   * Arrow keys, Home and End move between items; Escape closes and returns
   * focus to the trigger; Tab out of the menu closes it, and so does the
   * pointer leaving, unless the keyboard opened it.
   */
  type Props = {
    title: string;
    items: Array<{
      href: string;
      label: string;
      icon: string;
      description?: string;
      badge?: number;
      /**
       * What the badge counts, read out in place of the number. My Exchanges counts what
       * waits on the member and My Messages counts unopened conversations, so one wording
       * for both told a screen reader the wrong thing about one of them.
       */
      badgeLabel?: (n: number) => string;
    }>;
    alignRight?: boolean;
    /** A picture shown before the title: the member's own menu. */
    avatar?: string;
    /** An icon shown before the title. */
    icon?: NavIconName;
    /**
     * What a badge's number counts, said after it by a screen reader ("3 waiting to be
     * accepted"), for a menu whose items do not say it themselves. Without it the trigger
     * says what its one counted item counts if that item says it, otherwise "new", and an
     * item "waiting on you".
     */
    badgeLabel?: string;
    /** A sentence added to the trigger's name, e.g. the progenitor's setup hint (#361). */
    hint?: string;
    /**
     * A line under the items, not one of them: the arrow keys pass it by, and the trigger
     * gives it as its description so a screen reader hears it too. The Admin menu's Alt+A
     * hint (#359).
     */
    footer?: string;
  };

  let {
    title,
    items,
    alignRight = false,
    avatar,
    icon,
    badgeLabel,
    hint,
    footer
  }: Props = $props();

  const total = $derived(items.reduce((n, item) => n + (item.badge ?? 0), 0));
  /**
   * The count on the trigger, in words. One counted item says what it counts, so the
   * trigger says it the same way; "new" only when two different counts are added together.
   * (The bar's own counts are on My Exchanges and the envelope, which are links, not
   * menus; this serves any menu that carries one.)
   */
  const counted = $derived(items.filter((item) => item.badge));
  const totalLabel = $derived(
    counted.length === 1 && counted[0].badgeLabel ? counted[0].badgeLabel(total) : `${total} new`
  );

  const id = `nav-menu-${nextId++}`;
  let open = $state(false);
  // Opened by the keyboard (or a screen reader), so the pointer leaving does not
  // close it: a nudged mouse would unmount the item the member is on.
  let viaKeyboard = false;
  let trigger: HTMLButtonElement;
  let wrapper: HTMLDivElement;
  const links: HTMLAnchorElement[] = $state([]);

  async function focusItem(index: number) {
    open = true;
    viaKeyboard = true;
    await tick();
    links[index]?.focus();
  }

  function close(returnFocus = false) {
    open = false;
    viaKeyboard = false;
    if (returnFocus) trigger?.focus();
  }

  // A pointer click opens (hover may already have). Enter and Space are handled
  // in onTriggerKey, which cancels the click they would send. A click with no
  // key press and detail 0 is a screen reader in browse mode activating the
  // button, so it opens on the first item, as Enter does.
  function onTriggerClick(event: MouseEvent) {
    if (event.detail > 0) {
      // The member is on the pointer now, so the pointer leaving closes it again.
      open = true;
      viaKeyboard = false;
    } else focusItem(0);
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
    if (!wrapper?.contains(event.relatedTarget as Node | null)) close();
  }

  // The pointer leaving closes a hovered menu, but not one the keyboard opened:
  // a nudged mouse would unmount the item the member is on and drop focus to
  // the body. Escape, Tab and a click still close it. Reading how the menu was
  // opened, not where focus is, also closes a hovered menu whose item took
  // focus from a middle click.
  function onMouseLeave() {
    if (!viaKeyboard) open = false;
  }
</script>

<div
  class="group relative"
  role="presentation"
  onmouseenter={() => (open = true)}
  onmouseleave={onMouseLeave}
  onfocusout={onFocusOut}
  bind:this={wrapper}
>
  <button
    class="inline-flex items-center whitespace-nowrap rounded px-3 py-2 transition-colors hover:text-secondary-300 focus:outline-none focus:ring-2 focus:ring-secondary-300 focus:ring-opacity-50"
    id="{id}-trigger"
    bind:this={trigger}
    aria-expanded={open}
    aria-haspopup="menu"
    aria-controls={open ? id : undefined}
    onclick={onTriggerClick}
    onkeydown={onTriggerKey}
    aria-label={(total > 0
      ? `${title} menu, ${badgeLabel ? `${total} ${badgeLabel}` : totalLabel}`
      : `${title} menu`) + (hint ? `. ${hint}` : '')}
    aria-describedby={footer ? `${id}-footer` : undefined}
  >
    {#if avatar}
      <img src={avatar} alt="" class="mr-2 h-8 w-8 rounded-full bg-surface-200 object-cover" />
    {/if}
    {#if icon}
      <NavIcon name={icon} class="mr-1.5 h-5 w-5" />
    {/if}
    <!-- With a picture, the name shows only where there is room for it. -->
    <span class={avatar ? 'hidden max-w-[10rem] truncate 2xl:inline' : ''}>{title}</span>
    {#if total > 0}
      <span
        class="badge ml-1 bg-white px-1.5 py-0 text-xs font-semibold text-primary-700"
        aria-hidden="true">{shownCount(total)}</span
      >
    {/if}
    <svg
      class="ml-1 h-4 w-4 shrink-0 transition-transform duration-200 {open ? 'rotate-180' : ''}"
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
                      <!-- The number is for the eye; the words, for a screen reader. -->
                      <span class="variant-filled-primary badge px-1.5 py-0 text-xs"
                        ><span aria-hidden="true">{shownCount(item.badge)}</span><span
                          class="sr-only"
                          >{item.badgeLabel
                            ? item.badgeLabel(item.badge)
                            : `${item.badge} ${badgeLabel ?? 'waiting on you'}`}</span
                        ></span
                      >
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
        {#if footer}
          <!-- Outside the menu's items, so the arrow keys pass it by. -->
          <p class="border-t border-gray-200 px-4 py-2 text-xs text-gray-500" aria-hidden="true">
            {footer}
          </p>
        {/if}
      </div>
    </div>
  {/if}
  {#if footer}
    <!-- The trigger's description, there whether or not the menu is open. -->
    <span id="{id}-footer" class="sr-only">{footer}</span>
  {/if}
</div>
