<script lang="ts">
  import { onMount } from 'svelte';
  import { debounce } from '$lib/utils';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { UIServiceType } from '$lib/types/ui';

  type Props = {
    selectedTags?: string[];
    onTagsChange?: (tags: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
    maxSuggestions?: number;
    allowCustomTags?: boolean;
    label?: string;
    required?: boolean;
  };

  const {
    selectedTags = [],
    onTagsChange = () => {},
    placeholder = 'Type to search tags...',
    disabled = false,
    maxSuggestions = 10,
    allowCustomTags = true,
    label = 'Tags',
    required = false
  }: Props = $props();

  // State
  let inputValue = $state('');
  let suggestions = $state<string[]>([]);
  let showSuggestions = $state(false);
  let loading = $state(false);
  let inputElement: HTMLInputElement | null = $state(null);
  let suggestionsContainer: HTMLElement | null = $state(null);
  let activeSuggestionIndex = $state(-1);

  // Use the external tags directly - no internal state to sync
  const currentTags = $derived(selectedTags);

  // Load all available tags
  async function loadAllTags() {
    loading = true;
    try {
      // Load all tags from the store
      await runEffect(serviceTypesStore.loadAllTags());
      const allTags = serviceTypesStore.allTags || [];

      // Filter out already selected tags
      const availableTags = allTags.filter((tag) => !currentTags.includes(tag));

      suggestions = availableTags.slice(0, maxSuggestions);
      showSuggestions = suggestions.length > 0;
      activeSuggestionIndex = -1;
    } catch (error) {
      console.error('Error loading all tags:', error);
      suggestions = [];
      showSuggestions = false;
    } finally {
      loading = false;
    }
  }

  // Debounced search function
  const debouncedSearch = debounce(async (query: string) => {
    if (!query.trim()) {
      // Show all available tags when query is empty
      await loadAllTags();
      return;
    }

    loading = true;
    try {
      // Search for service types by tag prefix
      await runEffect(serviceTypesStore.searchServiceTypesByTagPrefix(query));
      const searchResults = serviceTypesStore.searchResults;

      // Extract unique tags that match the prefix
      const allTags = new Set<string>();
      searchResults.forEach((serviceType: UIServiceType) => {
        serviceType.tags.forEach((tag) => {
          if (tag.toLowerCase().startsWith(query.toLowerCase()) && !currentTags.includes(tag)) {
            allTags.add(tag);
          }
        });
      });

      suggestions = Array.from(allTags).slice(0, maxSuggestions);
      showSuggestions = suggestions.length > 0;
      activeSuggestionIndex = -1;
    } catch (error) {
      console.error('Error searching tags:', error);
      suggestions = [];
      showSuggestions = false;
    } finally {
      loading = false;
    }
  }, 300);

  // Handle input changes
  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    inputValue = target.value;
    debouncedSearch(inputValue);
  }

  // Handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (!showSuggestions) {
      if (event.key === 'Enter' && allowCustomTags && inputValue.trim()) {
        event.preventDefault();
        addTag(inputValue.trim());
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, suggestions.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (activeSuggestionIndex >= 0) {
          addTag(suggestions[activeSuggestionIndex]);
        } else if (allowCustomTags && inputValue.trim()) {
          addTag(inputValue.trim());
        }
        break;
      case 'Escape':
        event.preventDefault();
        hideSuggestions();
        break;
    }
  }

  // Add a tag
  function addTag(tag: string) {
    if (!tag.trim() || currentTags.includes(tag)) return;

    const newTags = [...currentTags, tag];
    onTagsChange(newTags);
    inputValue = '';
    hideSuggestions();
    inputElement?.focus();
  }

  // Remove a tag
  function removeTag(tagToRemove: string) {
    const newTags = currentTags.filter((tag) => tag !== tagToRemove);
    onTagsChange(newTags);
  }

  // Hide suggestions
  function hideSuggestions() {
    showSuggestions = false;
    activeSuggestionIndex = -1;
  }

  // Handle clicks outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!inputElement?.contains(target) && !suggestionsContainer?.contains(target)) {
      hideSuggestions();
    }
  }

  // Handle suggestion click
  function handleSuggestionClick(tag: string) {
    addTag(tag);
  }

  // Handle middle-click on tags to remove them
  function handleTagMiddleClick(event: MouseEvent, tag: string) {
    if (event.button === 1) {
      // Middle mouse button
      event.preventDefault();
      removeTag(tag);
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="space-y-2">
  <div class="label">
    {label} <span class="text-error-500">{required ? '*' : ''}</span>
  </div>

  <!-- Selected tags display -->
  {#if currentTags.length > 0}
    <div class="mb-2 flex flex-wrap gap-2">
      {#each currentTags as tag}
        <span
          class="variant-soft-primary chip cursor-pointer select-none"
          class:hover:variant-filled-primary={!disabled}
          onmousedown={(event) => !disabled && handleTagMiddleClick(event, tag)}
          role="button"
          tabindex={disabled ? -1 : 0}
          title={disabled ? tag : `${tag} (middle-click to remove)`}
        >
          {tag}
          {#if !disabled}
            <button
              type="button"
              class="ml-1 text-xs opacity-70 hover:opacity-100"
              onclick={() => removeTag(tag)}
              title="Remove {tag}"
            >
              ×
            </button>
          {/if}
        </span>
      {/each}
    </div>
  {/if}

  <!-- Input container -->
  <div class="relative">
    <input
      bind:this={inputElement}
      type="text"
      {placeholder}
      class="input w-full"
      class:cursor-not-allowed={disabled}
      {disabled}
      bind:value={inputValue}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={() => {
        if (inputValue.trim()) {
          debouncedSearch(inputValue);
        } else {
          // Show all available tags when focusing on empty input
          loadAllTags();
        }
      }}
      onclick={() => {
        if (!inputValue.trim()) {
          // Also show all tags when clicking on empty input
          loadAllTags();
        }
      }}
      autocomplete="off"
    />

    <!-- Loading indicator -->
    {#if loading}
      <div class="absolute right-3 top-1/2 -translate-y-1/2 transform">
        <div class="border-primary-500 h-4 w-4 animate-spin rounded-full border-b-2"></div>
      </div>
    {/if}

    <!-- Suggestions dropdown -->
    {#if showSuggestions && suggestions.length > 0}
      <div
        bind:this={suggestionsContainer}
        class="bg-surface-100-800-token border-surface-300-600-token absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border shadow-lg"
      >
        {#each suggestions as suggestion, index}
          <button
            type="button"
            class="hover:bg-surface-200-700-token focus:bg-surface-200-700-token w-full px-3 py-2 text-left focus:outline-none"
            class:bg-surface-200-700-token={index === activeSuggestionIndex}
            onclick={() => handleSuggestionClick(suggestion)}
          >
            <span class="text-sm">{suggestion}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Help text -->
  {#if !disabled}
    <div class="text-surface-500 text-sm">
      {#if allowCustomTags}
        Type to search existing tags or press Enter to create new ones
      {:else}
        Type to search existing tags
      {/if}
    </div>
  {/if}
</div>
