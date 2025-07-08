<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  type Props = {
    title: string;
    items: Array<{
      href: string;
      label: string;
      icon: string;
      description?: string;
    }>;
    isOpen?: boolean;
  };

  let { title, items, isOpen = false }: Props = $props();

  const dispatch = createEventDispatcher();
  let dropdownRef: HTMLDivElement;
  let isHovered = $state(false);
  let focusedIndex = $state(-1);

  function handleMouseEnter() {
    isHovered = true;
    focusedIndex = -1;
  }

  function handleMouseLeave() {
    isHovered = false;
    focusedIndex = -1;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!isHovered) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusedIndex = Math.max(focusedIndex - 1, -1);
        break;
      case 'Enter':
      case ' ':
        if (focusedIndex >= 0) {
          event.preventDefault();
          const item = items[focusedIndex];
          if (item) {
            window.location.href = item.href;
          }
        }
        break;
      case 'Escape':
        isHovered = false;
        focusedIndex = -1;
        break;
    }
  }

  function handleItemClick(href: string) {
    dispatch('navigate', { href });
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
  class="group relative"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  bind:this={dropdownRef}
>
  <button
    class="hover:text-secondary-300 focus:ring-secondary-300 rounded px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-opacity-50"
    aria-expanded={isHovered}
    aria-haspopup="true"
    aria-label={`${title} menu`}
  >
    {title}
    <svg
      class="ml-1 inline-block h-4 w-4 transition-transform duration-200 {isHovered
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

  <div
    class="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-xl transition-all duration-200 {isHovered
      ? 'visible translate-y-0 opacity-100'
      : 'invisible translate-y-2 opacity-0'}"
    role="menu"
    aria-orientation="vertical"
    aria-labelledby="menu-button"
  >
    <div class="py-2">
      {#each items as item, index}
        <a
          href={item.href}
          class="block px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50 focus:bg-gray-50 focus:outline-none {focusedIndex ===
          index
            ? 'bg-gray-50'
            : ''}"
          role="menuitem"
          onclick={() => handleItemClick(item.href)}
          onmouseenter={() => (focusedIndex = index)}
        >
          <div class="flex items-center gap-3">
            <span class="flex-shrink-0 text-lg">{item.icon}</span>
            <div class="min-w-0 flex-1">
              <div class="font-medium text-gray-900">{item.label}</div>
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

<style>
  /* Additional styles for better visual feedback */
  .group:hover .group-hover\:opacity-100 {
    z-index: 50;
  }
</style>
