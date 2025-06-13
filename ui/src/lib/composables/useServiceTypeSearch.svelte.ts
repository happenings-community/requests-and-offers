import { page } from '$app/state';
import type { UIServiceType } from '$lib/types/ui';

export interface ServiceTypeSearchState {
  searchTerm: string;
  selectedFilterTags: string[];
  tagFilterMode: 'any' | 'all';
  showAdvancedSearch: boolean;
}

export interface ServiceTypeSearchOptions {
  initialState?: Partial<ServiceTypeSearchState>;
  onStateChange?: (state: ServiceTypeSearchState) => void;
  tagCloudBehavior?: 'toggle' | 'add-only'; // toggle for admin, add-only for public
}

export function useServiceTypeSearch(options: ServiceTypeSearchOptions = {}) {
  const { initialState = {}, onStateChange, tagCloudBehavior = 'add-only' } = options;

  // Initialize search state
  const searchState = $state<ServiceTypeSearchState>({
    searchTerm: '',
    selectedFilterTags: [],
    tagFilterMode: 'any',
    showAdvancedSearch: false,
    ...initialState
  });

  // URL parameter handling for auto-selecting tags
  $effect(() => {
    if (!page.url) return;
    const tagParam = page.url.searchParams.get('tag');
    if (tagParam && !searchState.selectedFilterTags.includes(tagParam)) {
      searchState.selectedFilterTags = [tagParam];
      searchState.showAdvancedSearch = true;

      // Clear the URL parameter to prevent interference with tag removal
      const newUrl = new URL(page.url);
      newUrl.searchParams.delete('tag');
      window.history.replaceState({}, '', newUrl.toString());

      // Notify parent of state change
      onStateChange?.(searchState);
    }
  });

  // Check if any filters are active
  const hasActiveFilters = $derived(
    searchState.searchTerm.length > 0 || searchState.selectedFilterTags.length > 0
  );

  // Create derived state object
  const derivedSearchState = $derived(searchState);

  // Filter service types based on search criteria
  function filterServiceTypes(serviceTypes: UIServiceType[]): UIServiceType[] {
    return serviceTypes.filter((serviceType) => {
      // Apply text search filter
      let matchesText = true;
      if (searchState.searchTerm) {
        const lowerSearchTerm = searchState.searchTerm.toLowerCase();
        matchesText =
          serviceType.name.toLowerCase().includes(lowerSearchTerm) ||
          serviceType.description.toLowerCase().includes(lowerSearchTerm) ||
          serviceType.tags.some((tag) => tag.toLowerCase().includes(lowerSearchTerm));
      }

      // Apply tag filter
      let matchesTags = true;
      if (searchState.selectedFilterTags.length > 0) {
        if (searchState.tagFilterMode === 'all') {
          // AND logic: service type must have ALL selected tags
          matchesTags = searchState.selectedFilterTags.every((filterTag) =>
            serviceType.tags.some((tag) => tag.toLowerCase() === filterTag.toLowerCase())
          );
        } else {
          // OR logic: service type must have ANY of the selected tags
          matchesTags = searchState.selectedFilterTags.some((filterTag) =>
            serviceType.tags.some((tag) => tag.toLowerCase() === filterTag.toLowerCase())
          );
        }
      }

      return matchesText && matchesTags;
    });
  }

  // Handle tag filter changes
  function handleTagFilterChange(tags: string[]) {
    searchState.selectedFilterTags = tags;
    onStateChange?.(searchState);
  }

  // Clear all filters
  function clearAllFilters() {
    searchState.searchTerm = '';
    searchState.selectedFilterTags = [];

    // Also clear any URL parameters
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('tag');
    window.history.replaceState({}, '', newUrl.toString());

    onStateChange?.(searchState);
  }

  // Toggle advanced search visibility
  function toggleAdvancedSearch() {
    searchState.showAdvancedSearch = !searchState.showAdvancedSearch;
    onStateChange?.(searchState);
  }

  // Handle tag cloud clicks
  function handleTagCloudClick(tag: string) {
    if (tagCloudBehavior === 'toggle') {
      // Toggle behavior for admin pages
      if (searchState.selectedFilterTags.includes(tag)) {
        searchState.selectedFilterTags = searchState.selectedFilterTags.filter((t) => t !== tag);
      } else {
        searchState.selectedFilterTags = [...searchState.selectedFilterTags, tag];
      }
    } else {
      // Add-only behavior for public pages
      if (!searchState.selectedFilterTags.includes(tag)) {
        searchState.selectedFilterTags = [...searchState.selectedFilterTags, tag];
      }
    }

    // Show advanced search if not already visible
    if (!searchState.showAdvancedSearch) {
      searchState.showAdvancedSearch = true;
    }

    onStateChange?.(searchState);
  }

  // Update search term
  function updateSearchTerm(term: string) {
    searchState.searchTerm = term;
    onStateChange?.(searchState);
  }

  // Update tag filter mode
  function updateTagFilterMode(mode: 'any' | 'all') {
    searchState.tagFilterMode = mode;
    onStateChange?.(searchState);
  }

  return {
    // State - use the derived variables
    searchState: derivedSearchState,
    hasActiveFilters,

    // Actions
    filterServiceTypes,
    handleTagFilterChange,
    clearAllFilters,
    toggleAdvancedSearch,
    handleTagCloudClick,
    updateSearchTerm,
    updateTagFilterMode
  };
}
