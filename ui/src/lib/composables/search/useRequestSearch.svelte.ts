import type { UIRequest } from '$lib/types/ui';
import { useDebounce } from '$lib/utils';

// Search state interface
export interface RequestSearchState {
  searchTerm: string;
}

// Search options
export interface RequestSearchOptions {
  debounceMs?: number;
  onStateChange?: (state: RequestSearchState) => void;
}

// Return type
export interface RequestSearchReturn {
  searchState: RequestSearchState;
  hasActiveFilters: boolean;
  filterRequests: (requests: UIRequest[]) => UIRequest[];
  clearAllFilters: () => void;
  updateSearchTerm: (term: string) => void;
}

export function useRequestSearch(options: RequestSearchOptions = {}): RequestSearchReturn {
  const { debounceMs = 300, onStateChange } = options;

  // Initialize search state
  const state = $state<RequestSearchState>({
    searchTerm: ''
  });

  // Use debounce utility for search term updates
  const debouncedOnStateChange = useDebounce(
    ((...args: unknown[]) => {
      const searchState = args[0] as RequestSearchState;
      onStateChange?.(searchState);
    }) as (...args: unknown[]) => unknown,
    { delay: debounceMs }
  );

  // Check if any filters are active
  const hasActiveFilters = $derived(state.searchTerm.length > 0);

  // Filter requests based on search criteria
  function filterRequests(requests: UIRequest[]): UIRequest[] {
    let filtered = requests;

    // Apply text search filter
    if (state.searchTerm) {
      const lowerSearchTerm = state.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          request.title.toLowerCase().includes(lowerSearchTerm) ||
          request.description.toLowerCase().includes(lowerSearchTerm)
      );
    }

    return filtered;
  }

  // Clear all filters
  function clearAllFilters() {
    state.searchTerm = '';
    debouncedOnStateChange(state);
  }

  // Update search term
  function updateSearchTerm(term: string) {
    state.searchTerm = term;
    debouncedOnStateChange(state);
  }

  return {
    searchState: state,
    hasActiveFilters,
    filterRequests,
    clearAllFilters,
    updateSearchTerm
  };
}
