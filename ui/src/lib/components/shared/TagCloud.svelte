<script lang="ts">
  import { onMount } from 'svelte';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { runEffect } from '$lib/utils/effect';

  type Props = {
    onTagClick?: (tag: string) => void;
    maxTags?: number;
    showCounts?: boolean;
    className?: string;
  };

  const {
    onTagClick = () => {},
    maxTags = 20,
    showCounts = true,
    className = ''
  }: Props = $props();

  // State
  let tagStats = $state<Array<[string, number]>>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Get tag statistics from store
  const { tagStatistics } = $derived(serviceTypesStore);

  // Update local state when store changes
  $effect(() => {
    tagStats = tagStatistics.slice(0, maxTags);
  });

  // Calculate font sizes based on usage frequency
  const getTagSize = (count: number, maxCount: number): string => {
    const minSize = 0.75; // rem
    const maxSize = 1.5; // rem
    const ratio = count / maxCount;
    const size = minSize + (maxSize - minSize) * ratio;
    return `${size}rem`;
  };

  // Get color class based on frequency
  const getTagColorClass = (count: number, maxCount: number): string => {
    const ratio = count / maxCount;
    if (ratio >= 0.8) return 'text-primary-600 hover:text-primary-700';
    if (ratio >= 0.6) return 'text-secondary-600 hover:text-secondary-700';
    if (ratio >= 0.4) return 'text-tertiary-600 hover:text-tertiary-700';
    if (ratio >= 0.2) return 'text-surface-700 hover:text-surface-800';
    return 'text-surface-500 hover:text-surface-600';
  };

  async function loadTagStatistics() {
    loading = true;
    error = null;

    try {
      await runEffect(serviceTypesStore.getTagStatistics());
    } catch (err) {
      console.error('Error loading tag statistics:', err);
      error = err instanceof Error ? err.message : 'Failed to load tag statistics';
    } finally {
      loading = false;
    }
  }

  function handleTagClick(tag: string) {
    onTagClick(tag);
  }

  onMount(loadTagStatistics);

  // Calculate max count for sizing
  const maxCount = $derived(
    tagStats.length > 0 ? Math.max(...tagStats.map(([, count]) => count)) : 1
  );
</script>

<div class="rounded-lg border border-surface-300 bg-surface-50 dark:bg-surface-200 {className}">
  {#if loading}
    <div class="flex items-center justify-center p-4">
      <div class="h-6 w-6 animate-spin rounded-full border-b-2 border-primary-500"></div>
      <span class="ml-2 text-sm text-surface-600">Loading tags...</span>
    </div>
  {:else if error}
    <div class="p-4 text-sm text-error-500">
      Error loading tags: {error}
    </div>
  {:else if tagStats.length === 0}
    <div class="p-4 text-center text-sm text-surface-500">No tags available</div>
  {:else}
    <div class="flex flex-wrap gap-2 p-2">
      {#each tagStats as [tag, count]}
        <button
          type="button"
          class="rounded-md px-2 py-1 font-medium no-underline transition-all duration-200 hover:scale-105 hover:shadow-sm focus:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50 {getTagColorClass(
            count,
            maxCount
          )}"
          class:cursor-pointer={onTagClick}
          style="font-size: {getTagSize(count, maxCount)}"
          onclick={() => handleTagClick(tag)}
          title="{tag} ({count} service type{count === 1 ? '' : 's'})"
        >
          {tag}
          {#if showCounts}
            <span class="ml-1 text-xs opacity-70">({count})</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
