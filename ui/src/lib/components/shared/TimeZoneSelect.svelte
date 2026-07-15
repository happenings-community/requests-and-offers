<script lang="ts">
  import { DateTime } from 'luxon';
  import { popup, type PopupSettings } from '@skeletonlabs/skeleton';

  type Props = {
    value?: string;
    required?: boolean;
    label?: string;
    name?: string;
    id?: string;
    onchange?: (value: string | undefined) => void;
  };

  let {
    value = $bindable(),
    required = false,
    label = 'Time Zone',
    name,
    id,
    onchange
  }: Props = $props();

  // Stable popup target derived from id (or a fallback). Each instance gets a
  // unique target so multiple TimeZoneSelects on one page don't collide.
  const popupTarget = `tz-popup-${id ?? Math.random().toString(36).slice(2, 10)}`;

  const popupSettings: PopupSettings = {
    event: 'focus-click',
    target: popupTarget,
    placement: 'bottom-start',
    closeQuery: ''
  };

  // All IANA timezones, sorted once.
  const timezones = Intl.supportedValuesOf('timeZone').slice().sort();

  // Browser-detected timezone shown as a one-click suggestion. Never auto-committed.
  const detectedTimezone: string | undefined = (() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz && timezones.includes(tz) ? tz : undefined;
    } catch {
      return undefined;
    }
  })();

  // Local UI state
  let search = $state('');
  let isOpen = $state(false);
  let highlightedIndex = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state();
  let listEl: HTMLUListElement | undefined = $state();

  function getTimezoneDisplay(tz: string): string {
    try {
      const offset = DateTime.now().setZone(tz).toFormat('ZZ');
      return `${tz} (UTC${offset})`;
    } catch {
      return tz;
    }
  }

  // Prioritised substring filter:
  //   1. Matches at start of string (or after a '/') rank above mid-string matches.
  //   2. Within each group, alphabetical order.
  function filterAndRank(query: string): string[] {
    const q = query.trim().toLowerCase();
    if (!q) return timezones;
    const starts: string[] = [];
    const mids: string[] = [];
    for (const tz of timezones) {
      const lower = tz.toLowerCase();
      if (lower.startsWith(q) || lower.includes('/' + q)) {
        starts.push(tz);
      } else if (lower.includes(q)) {
        mids.push(tz);
      }
    }
    return [...starts, ...mids];
  }

  const filtered = $derived(filterAndRank(search));

  // The visible text in the input.
  //   - When the popup is closed: show the committed value's display string (or empty).
  //   - When the popup is open: show whatever the user is typing.
  const displayValue = $derived(isOpen ? search : value ? getTimezoneDisplay(value) : '');

  function commit(tz: string | undefined) {
    value = tz;
    onchange?.(tz);
    search = '';
    isOpen = false;
    highlightedIndex = -1;
  }

  function revert() {
    search = '';
    isOpen = false;
    highlightedIndex = -1;
  }

  function handleInput(event: Event) {
    search = (event.target as HTMLInputElement).value;
    isOpen = true;
    highlightedIndex = filtered.length > 0 ? 0 : -1;
  }

  function handleFocus() {
    isOpen = true;
    // Pre-fill the search with the committed display so the user can edit from it,
    // or leave empty for a fresh filter. We leave empty: cleaner UX.
    search = '';
    highlightedIndex = -1;
  }

  function handleBlur(event: FocusEvent) {
    // Defer so a click on a list item is processed before we close.
    const next = event.relatedTarget as Node | null;
    if (next && listEl?.contains(next)) return;
    revert();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        isOpen = true;
        highlightedIndex = 0;
        return;
      }
      if (filtered.length === 0) return;
      highlightedIndex = (highlightedIndex + 1) % filtered.length;
      scrollHighlightedIntoView();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen || filtered.length === 0) return;
      highlightedIndex = highlightedIndex <= 0 ? filtered.length - 1 : highlightedIndex - 1;
      scrollHighlightedIntoView();
    } else if (event.key === 'Enter') {
      if (!isOpen) return;
      event.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        commit(filtered[highlightedIndex]);
        inputEl?.blur();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      revert();
      inputEl?.blur();
    } else if (event.key === 'Tab') {
      // Let tab proceed naturally; just close the popup.
      revert();
    }
  }

  function scrollHighlightedIntoView() {
    queueMicrotask(() => {
      const el = listEl?.querySelector(`[data-tz-index="${highlightedIndex}"]`);
      (el as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
    });
  }

  function handleItemClick(tz: string) {
    commit(tz);
    inputEl?.blur();
  }

  // Stable id for the listbox so aria-controls / aria-activedescendant work.
  const listboxId = `tz-listbox-${id ?? popupTarget}`;
  const optionId = (i: number) => `${listboxId}-opt-${i}`;
</script>

<label class="label">
  <span>{label} <span class="text-error-500">{required ? '*' : ''}</span></span>

  <input
    bind:this={inputEl}
    type="text"
    class="input"
    role="combobox"
    autocomplete="off"
    aria-expanded={isOpen}
    aria-controls={listboxId}
    aria-activedescendant={highlightedIndex >= 0 ? optionId(highlightedIndex) : undefined}
    aria-required={required}
    placeholder="Select timezone..."
    value={displayValue}
    {id}
    oninput={handleInput}
    onfocus={handleFocus}
    onblur={handleBlur}
    onkeydown={handleKeydown}
    use:popup={popupSettings}
  />

  <!-- Hidden input keeps FormData submissions working for UserForm. -->
  <input type="hidden" {name} value={value ?? ''} {required} />
</label>

<div
  class="card z-20 max-h-72 w-full max-w-md overflow-auto p-2 shadow-xl"
  data-popup={popupTarget}
>
  <ul bind:this={listEl} role="listbox" id={listboxId} class="space-y-0.5">
    {#if detectedTimezone && !search}
      <li>
        <button
          type="button"
          class="w-full rounded px-3 py-2 text-left text-sm variant-soft-primary hover:variant-filled-primary"
          onclick={() => handleItemClick(detectedTimezone)}
        >
          <span class="block text-xs opacity-75">Detected from your browser</span>
          <span class="block font-medium">{getTimezoneDisplay(detectedTimezone)}</span>
        </button>
      </li>
      <li class="my-1 border-t border-surface-500/30"></li>
    {/if}

    {#if filtered.length === 0}
      <li class="px-3 py-2 text-sm opacity-60">No timezones match "{search}"</li>
    {:else}
      {#each filtered as tz, i (tz)}
        <li>
          <button
            type="button"
            id={optionId(i)}
            role="option"
            aria-selected={i === highlightedIndex}
            data-tz-index={i}
            class="w-full rounded px-3 py-2 text-left text-sm hover:variant-soft-primary
                   {i === highlightedIndex ? 'variant-soft-primary' : ''}
                   {tz === value ? 'font-semibold' : ''}"
            onmousedown={(e) => e.preventDefault()}
            onclick={() => handleItemClick(tz)}
          >
            {getTimezoneDisplay(tz)}
          </button>
        </li>
      {/each}
    {/if}
  </ul>
</div>
