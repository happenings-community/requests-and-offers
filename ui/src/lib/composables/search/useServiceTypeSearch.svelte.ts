import { page } from '$app/state';
import type {
  UIServiceType,
  UseComposableOptions,
  UseComposableReturn,
  SearchComposableState,
  UseSearchActions
} from '$lib/types/ui';
import type { BaseComposableError } from '$lib/types/error';
import { useDebounce } from '$lib/utils';
import { Effect as E, pipe } from 'effect';

// Use the standard search state from types
export interface ServiceTypeSearchState extends SearchComposableState {}

// Specialized search actions for service types
export interface ServiceTypeSearchActions extends UseSearchActions<UIServiceType> {
  updateSearchTerm: (term: string) => void;
  updateTagFilterMode: (mode: 'any' | 'all') => void;
  // Add the missing standard actions
  search: (term: string) => void;
  filter: (filters: Record<string, unknown>) => void;
  clearSearch: () => void;
  clearFilters: () => void;
  clearAll: () => void;
  filterEntities: (entities: UIServiceType[]) => UIServiceType[];
  // Reactive getters
  readonly hasActiveFilters: boolean;
}

export interface ServiceTypeSearchOptions extends UseComposableOptions<ServiceTypeSearchState> {
  tagCloudBehavior?: 'toggle' | 'add-only'; // toggle for admin, add-only for public
  debounceMs?: number;
}

export interface ServiceTypeSearchReturn
  extends UseComposableReturn<ServiceTypeSearchState, ServiceTypeSearchActions> {
  // Legacy properties for backward compatibility
  searchState: ServiceTypeSearchState;
  hasActiveFilters: boolean;
  filterServiceTypes: (serviceTypes: UIServiceType[]) => UIServiceType[];
  handleTagFilterChange: (tags: string[]) => void;
  clearAllFilters: () => void;
  toggleAdvancedSearch: () => void;
  handleTagCloudClick: (tag: string) => void;
  updateSearchTerm: (term: string) => void;
  updateTagFilterMode: (mode: 'any' | 'all') => void;
}

export function useServiceTypeSearch(
  options: ServiceTypeSearchOptions = {}
): ServiceTypeSearchReturn {
  const {
    initialState = {},
    onStateChange,
    tagCloudBehavior = 'add-only',
    debounceMs = 300
  } = options;

  // Initialize search state extending the base composable state
  const state = $state<ServiceTypeSearchState>({
    isLoading: false,
    error: null,
    searchTerm: '',
    selectedFilterTags: [],
    tagFilterMode: 'any',
    showAdvancedSearch: false,
    ...initialState
  });

  // Use debounce utility for search term updates
  const debouncedOnStateChange = useDebounce(
    (searchState: ServiceTypeSearchState) => {
      onStateChange?.(searchState);
    },
    { delay: debounceMs }
  );

  // State updater with optional change notification
  const updateState = (updates: Partial<ServiceTypeSearchState>, notify = true) => {
    Object.assign(state, updates);
    if (notify) {
      debouncedOnStateChange(state);
    }
  };

  // URL parameter handling for auto-selecting tags using Effect
  const handleUrlParamsEffect = (): E.Effect<void, never> =>
    E.sync(() => {
      if (!page.url) return;
      const tagParam = page.url.searchParams.get('tag');
      if (tagParam && !state.selectedFilterTags.includes(tagParam)) {
        updateState({
          selectedFilterTags: [tagParam],
          showAdvancedSearch: true
        });

        // Clear the URL parameter to prevent interference with tag removal
        const newUrl = new URL(page.url);
        newUrl.searchParams.delete('tag');
        window.history.replaceState({}, '', newUrl.toString());
      }
    });

  $effect(() => {
    // Run the Effect for URL parameter handling
    E.runSync(handleUrlParamsEffect());
  });

  // Check if any filters are active
  const hasActiveFilters = $derived(
    state.searchTerm.length > 0 || state.selectedFilterTags.length > 0
  );

  // Optimized filter function using Effect for better performance and error handling
  const filterServiceTypesEffect = (
    serviceTypes: UIServiceType[]
  ): E.Effect<UIServiceType[], never> =>
    pipe(
      E.succeed(serviceTypes),
      E.map((types) => {
        // Apply text search filter
        if (!state.searchTerm) return types;

        const lowerSearchTerm = state.searchTerm.toLowerCase();
        return types.filter(
          (serviceType) =>
            serviceType.name.toLowerCase().includes(lowerSearchTerm) ||
            serviceType.description.toLowerCase().includes(lowerSearchTerm) ||
            serviceType.tags.some((tag) => tag.toLowerCase().includes(lowerSearchTerm))
        );
      }),
      E.map((types) => {
        // Apply tag filter
        if (state.selectedFilterTags.length === 0) return types;

        return types.filter((serviceType) => {
          if (state.tagFilterMode === 'all') {
            // AND logic: service type must have ALL selected tags
            return state.selectedFilterTags.every((filterTag) =>
              serviceType.tags.some((tag) => tag.toLowerCase() === filterTag.toLowerCase())
            );
          } else {
            // OR logic: service type must have ANY of the selected tags
            return state.selectedFilterTags.some((filterTag) =>
              serviceType.tags.some((tag) => tag.toLowerCase() === filterTag.toLowerCase())
            );
          }
        });
      })
    );

  // Filter service types based on search criteria
  function filterResults(serviceTypes: UIServiceType[]): UIServiceType[] {
    return E.runSync(filterServiceTypesEffect(serviceTypes));
  }

  // State update functions using Effect for consistency
  const updateStateEffect = (updater: () => void): E.Effect<void, never> =>
    E.sync(() => {
      updater();
      onStateChange?.(state);
    });

  // Handle tag filter changes
  function handleTagFilterChange(tags: string[]) {
    E.runSync(
      updateStateEffect(() => {
        state.selectedFilterTags = tags;
      })
    );
  }

  // Clear all filters with URL cleanup
  const clearAllFiltersEffect = (): E.Effect<void, never> =>
    pipe(
      E.sync(() => {
        updateState(
          {
            searchTerm: '',
            selectedFilterTags: []
          },
          false
        );
      }),
      E.tap(() => {
        // Also clear any URL parameters
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('tag');
        window.history.replaceState({}, '', newUrl.toString());
      }),
      E.tap(() => onStateChange?.(state))
    );

  function clearAllFilters() {
    E.runSync(clearAllFiltersEffect());
  }

  // Toggle advanced search visibility
  function toggleAdvancedSearch() {
    E.runSync(
      updateStateEffect(() => {
        state.showAdvancedSearch = !state.showAdvancedSearch;
      })
    );
  }

  // Handle tag cloud clicks with optimized logic
  const handleTagCloudClickEffect = (tag: string): E.Effect<void, never> =>
    pipe(
      E.sync(() => {
        if (tagCloudBehavior === 'toggle') {
          // Toggle behavior for admin pages
          if (state.selectedFilterTags.includes(tag)) {
            state.selectedFilterTags = state.selectedFilterTags.filter((t) => t !== tag);
          } else {
            state.selectedFilterTags = [...state.selectedFilterTags, tag];
          }
        } else {
          // Add-only behavior for public pages
          if (!state.selectedFilterTags.includes(tag)) {
            state.selectedFilterTags = [...state.selectedFilterTags, tag];
          }
        }

        // Show advanced search if not already visible
        if (!state.showAdvancedSearch) {
          state.showAdvancedSearch = true;
        }
      }),
      E.tap(() => onStateChange?.(state))
    );

  function handleTagCloudClick(tag: string) {
    E.runSync(handleTagCloudClickEffect(tag));
  }

  // Update search term
  function updateSearchTerm(term: string) {
    E.runSync(
      updateStateEffect(() => {
        state.searchTerm = term;
      })
    );
  }

  // Update tag filter mode
  function updateTagFilterMode(mode: 'any' | 'all') {
    E.runSync(
      updateStateEffect(() => {
        state.tagFilterMode = mode;
      })
    );
  }

  // Actions object following the standard pattern
  const actions: ServiceTypeSearchActions = {
    // Standard search actions
    search: updateSearchTerm,
    filter: (filters: Record<string, unknown>) => {
      // Handle generic filters - could be extended later
      console.log('Filter not yet implemented for service types:', filters);
    },
    clearSearch: () => updateSearchTerm(''),
    clearFilters: () => handleTagFilterChange([]),
    clearAll: clearAllFilters,
    filterEntities: filterResults,
    handleTagFilterChange,
    toggleAdvancedSearch,
    handleTagCloudClick,
    // Custom actions specific to service types
    updateSearchTerm,
    updateTagFilterMode,
    // Reactive getters
    get hasActiveFilters() {
      return hasActiveFilters;
    }
  };

  return {
    state,
    actions,
    // Legacy properties for backward compatibility
    searchState: state,
    hasActiveFilters,
    filterServiceTypes: filterResults,
    handleTagFilterChange,
    clearAllFilters,
    toggleAdvancedSearch,
    handleTagCloudClick,
    updateSearchTerm,
    updateTagFilterMode
  };
}
